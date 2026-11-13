"""create_form: forms and client surveys the Agent can propose, and the nested-argument checks it relies on."""
import uuid

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from agent import actions
from agent.models import AgentAction, AgentConversation
from agent.tests.test_views import client_for, make_user
from agent.tools import ToolError, run_tool, tool_specs
from agent.tools.base import execute_write, propose_tool, validate_args
from onboarding.models import StandaloneForm
from onboarding.serializers import StandaloneFormSerializer

User = get_user_model()
FAST_HASH = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])


def survey():
    return {
        "title": "Client feedback",
        "intro": "Thanks for working with us.\nThis takes two minutes.",
        "questions": [
            {"label": "How would you rate the project?", "type": "multiple_choice",
             "options": ["1 - Poor", "2", "3", "4", "5 - Excellent"]},
            {"label": "What went well?", "type": "long_answer", "required": False, "placeholder": "Tell us more"},
            {"label": "Your name", "type": "short_answer"},
            {"label": "I agree to be contacted", "type": "checkbox", "required": False},
            {"label": "Attach a screenshot", "type": "file_upload", "required": False},
        ],
    }


class NestedArgumentTests(SimpleTestCase):
    """validate_args used to check flat values only; create_form sends a list of objects."""

    SCHEMA = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array", "minItems": 1, "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {"kind": {"type": "string", "enum": ["a", "b"]}, "tags": {"type": "array", "items": {"type": "string"}}},
                    "required": ["kind"],
                },
            },
        },
        "required": ["items"],
    }

    def fails(self, args, text):
        with self.assertRaises(ToolError) as caught:
            validate_args(self.SCHEMA, args)
        self.assertIn(text, str(caught.exception))

    def test_a_valid_nested_value_passes(self):
        args = {"items": [{"kind": "a", "tags": ["x"]}, {"kind": "b"}]}
        self.assertEqual(validate_args(self.SCHEMA, args), args)

    def test_an_array_must_be_a_list(self):
        self.fails({"items": "nope"}, "must be a list")
        self.fails({"items": {"kind": "a"}}, "must be a list")

    def test_array_length_limits(self):
        self.fails({"items": []}, "at least 1")
        self.fails({"items": [{"kind": "a"}] * 3}, "at most 2")

    def test_each_item_must_be_an_object(self):
        self.fails({"items": ["a"]}, "must be an object")

    def test_a_missing_nested_field_is_named(self):
        self.fails({"items": [{"tags": []}]}, "missing 'kind'")

    def test_an_unknown_nested_field_is_refused(self):
        self.fails({"items": [{"kind": "a", "extra": 1}]}, "extra")

    def test_a_bad_nested_value_says_where(self):
        self.fails({"items": [{"kind": "a"}, {"kind": "z"}]}, "items[2].kind")

    def test_a_bad_item_inside_a_nested_array_is_caught(self):
        self.fails({"items": [{"kind": "a", "tags": [1]}]}, "must be a string")


@FAST_HASH
class CreateFormTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")

    def forms(self):
        return StandaloneForm.objects.count()

    def refuses(self, args, text):
        before = self.forms()
        with self.assertRaises(ToolError) as caught:
            propose_tool(self.a, "create_form", args)
        self.assertIn(text, str(caught.exception))
        self.assertEqual(self.forms(), before)

    # --- the model can only propose --------------------------------------------------------

    def test_the_model_path_refuses_it_and_creates_nothing(self):
        with self.assertRaises(ToolError):
            run_tool(self.a, "create_form", survey())
        self.assertEqual(self.forms(), 0)

    def test_proposing_creates_nothing_and_describes_the_form(self):
        _, summary = propose_tool(self.a, "create_form", survey())
        self.assertEqual(self.forms(), 0)
        self.assertIn("Client feedback", summary)
        self.assertIn("5 questions", summary)

    def test_a_single_question_reads_naturally(self):
        _, summary = propose_tool(self.a, "create_form", {"title": "Quick", "questions": [{"label": "Name?", "type": "short_answer"}]})
        self.assertIn("1 question", summary)
        self.assertNotIn("1 questions", summary)

    def test_the_model_is_told_it_only_proposes(self):
        spec = next(s for s in tool_specs() if s["function"]["name"] == "create_form")
        self.assertIn("PROPOSES", spec["function"]["description"])

    # --- what gets created ------------------------------------------------------------------

    def test_it_creates_a_form_owned_by_the_caller_with_a_link_to_it(self):
        result = execute_write(self.a, "create_form", survey())
        form = StandaloneForm.objects.get(id=result["id"])
        self.assertEqual((form.creator, form.title), (self.a, "Client feedback"))
        self.assertEqual(result["link"], f"/forms/{form.id}")
        self.assertTrue(form.is_open)

    def test_blocks_match_what_the_form_builder_and_fill_page_expect(self):
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", survey())["id"])
        types = [b["type"] for b in form.blocks]
        self.assertEqual(types, ["welcome", "multiple_choice", "long_answer", "short_answer", "checkbox", "file_upload"])
        rating = form.blocks[1]
        self.assertEqual(rating["label"], "How would you rate the project?")
        self.assertEqual(rating["options"], ["1 - Poor", "2", "3", "4", "5 - Excellent"])
        self.assertTrue(rating["required"])  # questions are required unless said otherwise, as in the builder
        self.assertFalse(form.blocks[2]["required"])
        self.assertEqual(form.blocks[2]["placeholder"], "Tell us more")
        for block in form.blocks:
            self.assertEqual(set(block) - {"options", "content"}, {"id", "type", "label", "required", "placeholder"})
        self.assertNotIn("options", form.blocks[2])  # only multiple choice carries options

    def test_every_block_gets_its_own_uuid(self):
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", survey())["id"])
        ids = [b["id"] for b in form.blocks]
        self.assertEqual(len(set(ids)), len(ids))
        for value in ids:
            uuid.UUID(value)

    def test_no_intro_means_no_welcome_block(self):
        args = survey()
        del args["intro"]
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", args)["id"])
        self.assertNotIn("welcome", [b["type"] for b in form.blocks])

    def test_the_intro_is_escaped_into_plain_paragraphs(self):
        args = {**survey(), "intro": "<script>alert(1)</script>\n<img src=x onerror=alert(2)>\nSecond line"}
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", args)["id"])
        content = form.blocks[0]["content"]
        self.assertNotIn("<script", content)
        self.assertNotIn("<img", content)
        self.assertIn("&lt;script&gt;", content)
        self.assertEqual(content.count("<p>"), 3)
        self.assertTrue(content.startswith("<p>") and content.endswith("</p>"))

    def test_options_are_trimmed_and_blank_ones_dropped(self):
        args = {"title": "T", "questions": [{"label": "Pick", "type": "multiple_choice", "options": [" Yes ", "", "No"]}]}
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", args)["id"])
        self.assertEqual(form.blocks[0]["options"], ["Yes", "No"])

    def test_the_form_is_served_by_the_real_public_page_endpoint(self):
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", survey())["id"])
        response = APIClient().get(f"/api/v4/f/{form.slug}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["blocks"], form.blocks)
        self.assertEqual(StandaloneFormSerializer(form).data["blocks"], form.blocks)

    def test_a_response_can_be_submitted_to_it(self):
        form = StandaloneForm.objects.get(id=execute_write(self.a, "create_form", survey())["id"])
        answers = [{"block_index": 1, "value": "5 - Excellent"}]
        response = APIClient().post(f"/api/v4/f/{form.slug}/submit/", {"responses": answers}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(form.responses.count(), 1)

    # --- ownership and what the model may not set -------------------------------------------

    def test_the_model_cannot_choose_the_owner_slug_or_open_state(self):
        for extra in ({"creator": str(self.b.id)}, {"slug": "mine"}, {"is_open": False}, {"blocks": []}):
            self.refuses({**survey(), **extra}, "Unexpected argument")

    def test_the_form_always_belongs_to_the_user_who_confirmed_it(self):
        execute_write(self.b, "create_form", survey())
        self.assertEqual(StandaloneForm.objects.get().creator, self.b)
        self.assertEqual(self.a.standalone_forms.count(), 0)

    # --- bad input is refused with a message the model can act on ----------------------------

    def test_a_form_needs_questions(self):
        self.refuses({"title": "T", "questions": []}, "at least 1")
        self.refuses({"title": "T"}, "questions")

    def test_too_many_questions(self):
        many = [{"label": f"Q{i}", "type": "short_answer"} for i in range(31)]
        self.refuses({"title": "T", "questions": many}, "at most 30")

    def test_thirty_questions_are_fine(self):
        thirty = [{"label": f"Q{i}", "type": "short_answer"} for i in range(30)]
        execute_write(self.a, "create_form", {"title": "T", "questions": thirty})
        self.assertEqual(len(StandaloneForm.objects.get().blocks), 30)

    def test_an_unknown_question_type_is_refused(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "rating"}]}, "questions[1].type")

    def test_the_welcome_type_is_not_a_question(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "welcome"}]}, "questions[1].type")

    def test_multiple_choice_needs_two_options(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "multiple_choice", "options": ["Only"]}]}, "at least 2")
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "multiple_choice"}]}, "at least 2")
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "multiple_choice", "options": ["A", " "]}]}, "at least 2")

    def test_options_must_differ(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "multiple_choice", "options": ["Yes", "yes"]}]}, "different")

    def test_too_many_options(self):
        eleven = [str(i) for i in range(11)]
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "multiple_choice", "options": eleven}]}, "at most 10")

    def test_only_multiple_choice_takes_options(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "short_answer", "options": ["A", "B"]}]}, "only multiple_choice")

    def test_blank_title_or_label(self):
        self.refuses({"title": "   ", "questions": [{"label": "Q", "type": "short_answer"}]}, "needs a title")
        self.refuses({"title": "T", "questions": [{"label": "  ", "type": "short_answer"}]}, "needs a label")

    def test_unknown_or_missing_question_fields(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "short_answer", "html": "<b>"}]}, "html")
        self.refuses({"title": "T", "questions": [{"type": "short_answer"}]}, "missing 'label'")

    def test_overlong_text_is_refused(self):
        self.refuses({"title": "x" * 256, "questions": [{"label": "Q", "type": "short_answer"}]}, "at most 255")
        self.refuses({"title": "T", "intro": "x" * 1001, "questions": [{"label": "Q", "type": "short_answer"}]}, "at most 1000")
        self.refuses({"title": "T", "questions": [{"label": "x" * 301, "type": "short_answer"}]}, "at most 300")

    def test_required_must_be_a_real_boolean(self):
        self.refuses({"title": "T", "questions": [{"label": "Q", "type": "short_answer", "required": "yes"}]}, "true or false")


@FAST_HASH
class ProposeAndConfirmTests(TestCase):
    """The whole path a real request takes: propose, then confirm through the endpoint."""

    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.conversation = AgentConversation.objects.create(user=self.a)

    def test_nothing_exists_until_confirmed_then_the_form_appears(self):
        action = actions.propose(self.conversation, "create_form", survey())
        self.assertEqual(StandaloneForm.objects.count(), 0)
        self.assertEqual(action.arguments["questions"][0]["label"], "How would you rate the project?")

        response = client_for(self.a).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(response.status_code, 200)
        action.refresh_from_db()
        self.assertEqual(action.status, "executed")
        form = StandaloneForm.objects.get()
        self.assertEqual(form.creator, self.a)
        self.assertEqual(action.result["link"], f"/forms/{form.id}")

    def test_another_user_cannot_confirm_it(self):
        action = actions.propose(self.conversation, "create_form", survey())
        response = client_for(self.b).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(StandaloneForm.objects.count(), 0)
        action.refresh_from_db()
        self.assertEqual(action.status, "pending")

    def test_confirming_twice_creates_one_form(self):
        action = actions.propose(self.conversation, "create_form", survey())
        client = client_for(self.a)
        client.post(f"/api/v9/actions/{action.id}/confirm/")
        client.post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(StandaloneForm.objects.count(), 1)

    def test_tampered_stored_arguments_are_refused_at_confirm(self):
        action = actions.propose(self.conversation, "create_form", survey())
        AgentAction.objects.filter(id=action.id).update(arguments={**survey(), "questions": [{"label": "Q", "type": "bogus"}]})
        response = client_for(self.a).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(StandaloneForm.objects.count(), 0)

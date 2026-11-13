"""create_onboarding_form: the form a client fills in to get their portal. Unlike a plain form it must
belong to one of the user's own projects."""
import uuid

from django.test import TestCase, override_settings

from agent import actions, memory
from agent.models import AgentConversation
from agent.tests.test_views import client_for, make_user
from agent.tools import ToolError, run_tool, tool_specs
from agent.tools.base import execute_write, propose_tool
from onboarding.models import OnboardingInstance, OnboardingTemplate, StandaloneForm
from onboarding.serializers import OnboardingTemplateSerializer
from project.models import Project

FAST_HASH = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])


@FAST_HASH
class CreateOnboardingFormTests(TestCase):
    def setUp(self):
        self.a = make_user("a@test.com")
        self.b = make_user("b@test.com")
        self.project = Project.objects.create(creator=self.a, name="Brand refresh")
        self.theirs = Project.objects.create(creator=self.b, name="Not mine")
        self.conversation = AgentConversation.objects.create(user=self.a)

    def intake(self, **over):
        return {
            "project_id": str(self.project.id),
            "title": "Client intake",
            "intro": "Welcome aboard.",
            "questions": [
                {"label": "Company name", "type": "short_answer"},
                {"label": "Budget", "type": "multiple_choice", "options": ["Under 5k", "5k to 10k", "Over 10k"]},
                {"label": "Brand assets", "type": "file_upload", "required": False},
            ],
            **over,
        }

    def refused(self, args, text):
        with self.assertRaises(ToolError) as caught:
            propose_tool(self.a, "create_onboarding_form", args)
        self.assertIn(text, str(caught.exception))

    def test_the_model_cannot_run_it_directly(self):
        with self.assertRaises(ToolError):
            run_tool(self.a, "create_onboarding_form", self.intake())
        self.assertEqual(OnboardingTemplate.objects.count(), 0)

    def test_the_card_names_the_form_and_the_project(self):
        _, summary = propose_tool(self.a, "create_onboarding_form", self.intake())
        self.assertEqual(summary, 'Create the client onboarding form "Client intake" for the project "Brand refresh" with 3 questions')

    def test_confirming_creates_an_onboarding_form_linked_to_the_project_not_a_plain_form(self):
        action = actions.propose(self.conversation, "create_onboarding_form", self.intake())
        self.assertEqual(OnboardingTemplate.objects.count(), 0)

        response = client_for(self.a).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(response.status_code, 200)
        form = OnboardingTemplate.objects.get()
        self.assertEqual((form.creator, form.project, form.title), (self.a, self.project, "Client intake"))
        self.assertEqual(StandaloneForm.objects.count(), 0)
        action.refresh_from_db()
        self.assertEqual(action.result["link"], f"/onboarding/{form.id}")

    def test_the_blocks_are_what_the_builder_and_fill_page_expect(self):
        form = OnboardingTemplate.objects.get(id=execute_write(self.a, "create_onboarding_form", self.intake())["id"])
        self.assertEqual([b["type"] for b in form.blocks], ["welcome", "short_answer", "multiple_choice", "file_upload"])
        self.assertEqual(form.blocks[0]["content"], "<p>Welcome aboard.</p>")
        self.assertEqual(form.blocks[2]["options"], ["Under 5k", "5k to 10k", "Over 10k"])
        self.assertTrue(all(b["id"] for b in form.blocks))
        self.assertEqual(OnboardingTemplateSerializer(form).data["project_name"], "Brand refresh")

    def test_it_never_generates_a_client_link(self):
        execute_write(self.a, "create_onboarding_form", self.intake())
        self.assertEqual(OnboardingInstance.objects.count(), 0)

    def test_a_project_is_required(self):
        args = self.intake()
        del args["project_id"]
        self.refused(args, "project_id")

    def test_another_creators_project_a_made_up_id_and_a_bad_id_all_read_as_not_found(self):
        for project_id in (str(self.theirs.id), str(uuid.uuid4()), "not-an-id"):
            self.refused(self.intake(project_id=project_id), "Project not found")
        self.assertEqual(OnboardingTemplate.objects.count(), 0)

    def test_a_project_that_stops_being_yours_is_refused_at_confirm(self):
        action = actions.propose(self.conversation, "create_onboarding_form", self.intake())
        self.project.delete()
        response = client_for(self.a).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(OnboardingTemplate.objects.count(), 0)

    def test_a_second_one_with_the_same_title_is_refused_unless_a_copy_was_asked_for(self):
        execute_write(self.a, "create_onboarding_form", self.intake())
        self.refused(self.intake(title="client INTAKE"), "already have a client onboarding form")
        execute_write(self.a, "create_onboarding_form", self.intake(allow_duplicate=True))
        self.assertEqual(OnboardingTemplate.objects.count(), 2)

    def test_a_plain_form_with_the_same_title_does_not_block_it(self):
        execute_write(self.a, "create_form", {k: v for k, v in self.intake().items() if k != "project_id"})
        execute_write(self.a, "create_onboarding_form", self.intake())
        self.assertEqual(OnboardingTemplate.objects.count(), 1)

    def test_question_rules_are_the_same_as_a_plain_form(self):
        self.refused(self.intake(questions=[{"label": "Pick", "type": "multiple_choice", "options": ["One"]}]), "at least 2 options")

    def test_the_description_steers_client_portals_here(self):
        spec = next(s for s in tool_specs() if s["function"]["name"] == "create_onboarding_form")
        self.assertIn("client portal", spec["function"]["description"])
        self.assertIn("project_id", spec["function"]["parameters"]["required"])

    def test_the_agent_remembers_it_as_an_onboarding_form(self):
        action = actions.propose(self.conversation, "create_onboarding_form", self.intake())
        client_for(self.a).post(f"/api/v9/actions/{action.id}/confirm/")
        self.assertIn('client onboarding form (update_form cannot change it) "Client intake"', memory.created_note(self.conversation))

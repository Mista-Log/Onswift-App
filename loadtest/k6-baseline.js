// OnSwift backend baseline load test (k6).
//
// What it does: signs in ONCE as a creator and ONCE as a talent, then has up to 500 simulated people
// load the data those roles fetch most (profile, settings, notifications, projects, team, tasks).
//
// What it deliberately does not do:
//   - It never writes. Every request after the two sign-ins is a GET, so no data is created or changed
//     and no email is sent.
//   - It never signs in again. Login is rate limited (10 a minute), so hammering it would only measure
//     the limiter. Tokens last 20 minutes; the full run is 15.
//
// Run (the full commands are in TEARDOWN.md, "Running the test"):
//   k6 run -e BASE_URL=https://... -e CREATOR_EMAIL=... -e CREATOR_PASSWORD=... \
//          -e TALENT_EMAIL=... -e TALENT_PASSWORD=... loadtest/k6-baseline.js
//
// Options:
//   -e SMOKE=1      2 users for 30 seconds. Always do this first to prove the script and accounts work.
//   -e MAX_VUS=200  cap the peak (default 500). The three plateaus scale with it: 10%, 40%, 100%.

import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "").replace(/\/+$/, "");
const MAX_VUS = parseInt(__ENV.MAX_VUS || "500", 10);
const SMOKE = !!__ENV.SMOKE;

// Requests that came back as a server error or not at all: "the backend is struggling".
// (k6's own http_req_failed also counts refusals such as 401, 403 and 429.)
const serverErrors = new Rate("server_errors");

const low = Math.max(1, Math.round(MAX_VUS * 0.1));
const mid = Math.max(1, Math.round(MAX_VUS * 0.4));

export const options = {
  stages: SMOKE
    ? [{ duration: "2s", target: 2 }, { duration: "28s", target: 2 }] // both roles running almost at once
    : [
        { duration: "1m", target: low }, //     ramp to 50
        { duration: "3m", target: low }, //     hold 50
        { duration: "2m", target: mid }, //     ramp to 200
        { duration: "3m", target: mid }, //     hold 200
        { duration: "2m", target: MAX_VUS }, // ramp to 500
        { duration: "3m", target: MAX_VUS }, // hold 500
        { duration: "1m", target: 0 }, //       ramp down   (15 minutes in all)
      ],
  thresholds: {
    // Safety stop: if a quarter of requests are failing on the server side, the backend or database is
    // past its limit. Stop instead of piling on. (Waits 30s first so one bad moment doesn't end the run.)
    server_errors: [{ threshold: "rate<0.25", abortOnFail: true, delayAbortEval: "30s" }],
    // Not pass/fail targets. Listing each endpoint here makes k6 print its own timing line.
    "http_req_duration{name:me}": ["p(95)>=0"],
    "http_req_duration{name:settings}": ["p(95)>=0"],
    "http_req_duration{name:notifications}": ["p(95)>=0"],
    "http_req_duration{name:projects}": ["p(95)>=0"],
    "http_req_duration{name:team}": ["p(95)>=0"],
    "http_req_duration{name:my-tasks}": ["p(95)>=0"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

function login(role, email, password) {
  if (!email || !password) fail(`Missing ${role} credentials. Pass -e ${role}_EMAIL=... -e ${role}_PASSWORD=...`);
  const res = http.post(`${BASE_URL}/api/v1/auth/login/`, JSON.stringify({ email, password }), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "login" },
  });
  if (res.status !== 200 || !res.json("access")) {
    fail(`${role} sign-in failed (HTTP ${res.status}). Does this account exist on this backend? Body: ${String(res.body).slice(0, 200)}`);
  }
  return res.json("access");
}

// Runs once, before any simulated user starts.
export function setup() {
  if (!BASE_URL) fail("Missing BASE_URL. Pass -e BASE_URL=https://your-backend");
  return {
    creator: login("CREATOR", __ENV.CREATOR_EMAIL, __ENV.CREATOR_PASSWORD),
    talent: login("TALENT", __ENV.TALENT_EMAIL, __ENV.TALENT_PASSWORD),
  };
}

// Each role's "open the app" set of reads. Paths are ones the frontend really calls on load.
const SHARED = [
  ["me", "/api/v1/auth/user/"],
  ["settings", "/api/v1/settings/"],
  ["notifications", "/api/v3/notifications/"],
  ["projects", "/api/v2/projects/"],
];
const PAGES = {
  creator: [...SHARED, ["team", "/api/v3/team/"]],
  talent: [...SHARED, ["my-tasks", "/api/v2/my-tasks/"]],
};

export default function (tokens) {
  // Odd-numbered users act as the creator, even-numbered as the talent: an even split.
  const role = __VU % 2 === 1 ? "creator" : "talent";
  const headers = { Authorization: `Bearer ${tokens[role]}` };

  for (const [name, path] of PAGES[role]) {
    const res = http.get(`${BASE_URL}${path}`, { headers, tags: { name, role } });
    serverErrors.add(res.status === 0 || res.status >= 500);
    check(res, { [`${name} is 200`]: (r) => r.status === 200 });
    sleep(0.5 + Math.random()); // a person doesn't fire every request at once
  }
  sleep(1 + Math.random() * 2); // reading the page before the next load
}

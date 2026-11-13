import "server-only";
import { CONTACTS, VENUE_ADDRESS, VENUE_NAME, WHATSAPP_GROUP_URL } from "@/lib/venue";
import { formatDay, formatRange12 } from "@/lib/shifts";
import type { PlanShift } from "./plan";

/** Details copied into email_outbox.payload when a booking email is queued. */
export interface ShiftEmailPayload {
  full_name: string;
  email: string;
  title: string;
  department: string;
  start_time: string;
  end_time: string;
}

/** Payload for the reminder and event emails: every upcoming shift the volunteer holds. */
export interface ReminderPayload {
  full_name: string;
  email: string;
  shifts: PlanShift[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* One template for every email. Only the shift cards (and their times) change per volunteer.
 * Wording and layout follow email-previews/1-morning-reminder.html. */

/** Subject line of every email. */
const SUBJECT = "Reminder: Your Upcoming Volunteer Shifts - ISKCON 60th Anniversary Gala";

/** Main heading of every email. */
const GALA_TITLE = "ISKCON 60th Anniversary Gala";
const THANK_YOU = "Thank you for signing up for the ISKCON 60th Anniversary Gala. Your support is deeply appreciated.";
const REMINDER_LINE = (many: boolean) => `This is a reminder of your upcoming volunteer ${many ? "shifts" : "shift"}.`;
/** Shown instead of the shift cards when a volunteer has no shift yet. */
const NO_SHIFT_LINE =
  "We noticed that you have not yet chosen your roles or departments. Please note that role assignments close tonight. If you haven't done so yet, please sign in to the volunteer dashboard and select your preferred roles and departments.";
const PREPARE =
  "Please join the WhatsApp group if you are not already, and please read the volunteer guidelines before checking in. Please arrive at least 15 minutes early before your shift starts.";
const DRESS_CODE = "Black Tie / Formal / Indian Devotional / Festival Attire.";

/* Email palette: light and warm, with deep maroon and saffron accents. Chosen for
 * clear reading in every mail app; it does not follow the web app's colours. */
const C = {
  page: "#f3efe8",
  card: "#ffffff",
  band: "#6b2412",
  bandSub: "#f6e2b3",
  rule: "#d6a54a",
  ink: "#2a1f16",
  body: "#3d3329",
  label: "#9a5b14",
  muted: "#6b5d4f",
  line: "#e6dccb",
  shiftBg: "#fbf6ec",
  shiftEdge: "#d9822b",
  button: "#7a2e12",
  buttonText: "#ffffff",
  footerBg: "#f7f3ec",
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const DASHBOARD_URL = `${SITE}/dashboard`;
const GUIDELINES_URL = `${SITE}/dashboard?tab=guidelines`;
const LOGO_URL = `${SITE}/brand/logo-circle.png`;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Full name, as entered by the volunteer. Falls back to "Volunteer" if blank. */
function displayName(full: string): string {
  return full.trim() || "Volunteer";
}

/** Shared frame for every email. */
function layout(opts: { preheader: string; heading: string; bodyHtml: string }): string {
  const contacts = CONTACTS.map(
    (c) => `<div style="margin:0 0 6px;">${esc(c.name)}: <a href="tel:${esc(c.phone.replace(/\s/g, ""))}" style="color:${C.label};text-decoration:none;font-weight:bold;">${esc(c.phone)}</a></div>`,
  ).join("");
  const logo = SITE
    ? `<img src="${esc(LOGO_URL)}" width="72" height="72" alt="" style="display:block;margin:0 auto 14px;border-radius:50%;">`
    : "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(GALA_TITLE)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${SANS};color:${C.body};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${C.card};border-radius:14px;overflow:hidden;box-shadow:0 2px 14px rgba(42,31,22,0.08);">
      <tr><td align="center" style="padding:36px 32px 28px;background:${C.band};">
        ${logo}
        <h1 style="margin:0;font-family:${SERIF};font-size:30px;line-height:1.25;font-weight:bold;color:#ffffff;">${esc(GALA_TITLE)}</h1>
        <div style="width:64px;height:2px;background:${C.rule};margin:16px auto 14px;line-height:2px;font-size:0;">&nbsp;</div>
        <div style="font-family:${SERIF};font-size:17px;font-style:italic;color:${C.bandSub};">${esc(opts.heading)}</div>
      </td></tr>
      <tr><td style="padding:32px 36px 28px;font-size:15px;line-height:1.65;color:${C.body};">
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:24px 36px;background:${C.footerBg};border-top:1px solid ${C.line};font-size:13px;color:${C.muted};line-height:1.6;">
        <div style="margin-bottom:8px;font-family:${SERIF};font-size:15px;color:${C.ink};font-weight:bold;">Need help?</div>
        <p style="margin:0 0 12px;">Please contact one of our volunteer coordinators.</p>
        ${contacts}
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid ${C.line};font-size:12px;">${esc(VENUE_NAME)} · ${esc(VENUE_ADDRESS)}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Primary button: solid maroon, white text. */
function button(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:13px 24px;border-radius:8px;background-color:${C.button};color:${C.buttonText};text-decoration:none;font-weight:bold;font-size:15px;">${esc(label)}</a>`;
}

/** One shift, as a card with a saffron edge. */
function shiftCard(s: PlanShift): string {
  const deptLine = s.department
    ? `<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:${C.label};font-weight:bold;">${esc(s.department)}</div>`
    : "";
  const titleLine = s.title
    ? `<div style="font-family:${SERIF};font-size:18px;font-weight:bold;color:${C.ink};margin-top:4px;">${esc(s.title)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${C.shiftBg};border:1px solid ${C.line};border-left:4px solid ${C.shiftEdge};border-radius:8px;">
  <tr><td style="padding:16px 20px;">
    ${deptLine}
    ${titleLine}
    <div style="margin-top:8px;color:${C.body};">${esc(formatDay(s.start_time))}</div>
    <div style="color:${C.body};">${esc(formatRange12(s.start_time, s.end_time))}</div>
  </td></tr>
</table>`;
}

/** Dress code box. */
function dressCodeHtml(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:${C.footerBg};border-radius:8px;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0;"><strong style="color:${C.ink};">Dress code:</strong> ${esc(DRESS_CODE)}</p>
  </td></tr>
</table>`;
}

/** Volunteer resources block: WhatsApp group and guidelines. */
function resourcesHtml(): string {
  return `<p style="margin:22px 0 8px;font-family:${SERIF};font-size:16px;font-weight:bold;color:${C.ink};">Volunteer Resources</p>
${button("WhatsApp Group", WHATSAPP_GROUP_URL)}
${button("Volunteer Guidelines", GUIDELINES_URL)}
${button("Volunteer Dashboard", DASHBOARD_URL)}`;
}

function resourcesText(): string {
  return [
    "Volunteer Resources:",
    `- WhatsApp Group: ${WHATSAPP_GROUP_URL}`,
    `- Volunteer Guidelines: ${GUIDELINES_URL}`,
    `- Volunteer Dashboard: ${DASHBOARD_URL}`,
  ].join("\n");
}

const SIGN_OFF_1 = "Thank you for your time, devotion, and selfless service,";
const SIGN_OFF_2 = "ISKCON 60th Anniversary Gala Organizing Team.";

/** Closing lines. */
function signOffHtml(): string {
  return `<p style="margin:22px 0 0;color:${C.muted};">${esc(SIGN_OFF_1)}<br><strong style="color:${C.ink};">${esc(SIGN_OFF_2)}</strong></p>`;
}

function contactsText(): string {
  return [
    "",
    "Need help?",
    "Please contact one of our volunteer coordinators.",
    ...CONTACTS.map((c) => `- ${c.name}: ${c.phone}`),
  ].join("\n");
}

function shiftText(s: PlanShift): string {
  const label = [s.department, s.title].filter(Boolean).join(": ");
  const when = `${formatDay(s.start_time)}, ${formatRange12(s.start_time, s.end_time)}`;
  return label ? `${label}\n${when}` : when;
}

/* ---------------------------------------------------------------------------
 * The one email. Every kind below renders through this.
 * ------------------------------------------------------------------------- */

function renderVolunteerEmail(p: { full_name: string; shifts: PlanShift[] }): RenderedEmail {
  const shifts = [...p.shifts].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const hasShifts = shifts.length > 0;
  const many = shifts.length > 1;
  const name = displayName(p.full_name);

  const heading = hasShifts ? "Your upcoming shifts" : "Choose your volunteer roles";
  const preheader = hasShifts
    ? `Your volunteer ${many ? "shifts" : "shift"}${shifts[0].title ? `: ${shifts[0].title}` : ""}`
    : "Please choose your volunteer roles";
  const intro = hasShifts ? REMINDER_LINE(many) : NO_SHIFT_LINE;

  const bodyHtml = `<p style="font-family:${SERIF};font-size:17px;color:${C.ink};margin:0 0 16px;">Hare Krishna, ${esc(name)}</p>
<p>${esc(THANK_YOU)}</p>
<p>${esc(intro)}</p>
${hasShifts ? shifts.map(shiftCard).join("") : `<p style="margin:10px 0 0;">${button("Go to Volunteer Dashboard", DASHBOARD_URL)}</p>`}
<p>${esc(PREPARE)}</p>
${dressCodeHtml()}
${resourcesHtml()}
${signOffHtml()}`;

  const text = `Hare Krishna, ${name}

${THANK_YOU}

${intro}
${hasShifts ? `\n${shifts.map(shiftText).join("\n\n")}\n` : `\n${DASHBOARD_URL}\n`}
${PREPARE}

Dress code: ${DRESS_CODE}

${resourcesText()}

${SIGN_OFF_1}
${SIGN_OFF_2}
${contactsText()}`;

  return {
    subject: SUBJECT,
    html: layout({ preheader, heading, bodyHtml }),
    text,
  };
}

/* ---------------------------------------------------------------------------
 * Entry points used by the outbox and the admin test panel. All of them render
 * the same email; only the shifts differ.
 * ------------------------------------------------------------------------- */

export function renderBookingConfirmed(p: ShiftEmailPayload): RenderedEmail {
  return renderVolunteerEmail({ full_name: p.full_name, shifts: [p] });
}

export function renderBookingCancelled(p: ShiftEmailPayload): RenderedEmail {
  return renderVolunteerEmail({ full_name: p.full_name, shifts: [p] });
}

export function renderShiftReminder(p: ReminderPayload): RenderedEmail {
  return renderVolunteerEmail({ full_name: p.full_name, shifts: p.shifts });
}

export function renderEventEmail(p: { full_name: string }): RenderedEmail {
  return renderVolunteerEmail({ full_name: p.full_name, shifts: [] });
}

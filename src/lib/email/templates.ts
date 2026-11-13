import "server-only";
import { CONTACTS, VENUE_ADDRESS, VENUE_NAME, WHATSAPP_GROUP_URL } from "@/lib/venue";
import { formatDay, formatRange12, formatTime12 } from "@/lib/shifts";
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

/** Main heading of every email. */
const GALA_TITLE = "ISKCON 60th Anniversary Gala";
const THANK_YOU = "Thank you for signing up for the ISKCON Ksetra anniversary gala event.";
const SUPPORT = "Your support is deeply appreciated.";

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

const DRESS_CODE = "Black tie / formal wear / Indian devotional or festival attire.";
const CHECK_IN =
  "As soon as you arrive, please check in at the reception and collect your volunteer badge.";
const PREPARE =
  "Please join the WhatsApp group if you are not already, and please read the volunteer guidelines before checking in. Please arrive at least 15 minutes early before your shift starts.";

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

/** Shared frame for all three emails. */
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

/** Secondary button: white with a maroon outline. */
function outlineButton(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 23px;border-radius:8px;background-color:#ffffff;border:1.5px solid ${C.button};color:${C.button};text-decoration:none;font-weight:bold;font-size:15px;">${esc(label)}</a>`;
}

/** One shift, as a card with a saffron edge. */
function shiftCard(s: PlanShift): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${C.shiftBg};border:1px solid ${C.line};border-left:4px solid ${C.shiftEdge};border-radius:8px;">
  <tr><td style="padding:16px 20px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:${C.label};font-weight:bold;">${esc(s.department)}</div>
    <div style="font-family:${SERIF};font-size:18px;font-weight:bold;color:${C.ink};margin-top:4px;">${esc(s.title)}</div>
    <div style="margin-top:8px;color:${C.body};">${esc(formatDay(s.start_time))}</div>
    <div style="color:${C.body};">${esc(formatRange12(s.start_time, s.end_time))}</div>
  </td></tr>
</table>`;
}

/** Volunteer resources block: WhatsApp group and guidelines. */
function resourcesHtml(): string {
  return `<p style="margin:22px 0 8px;font-family:${SERIF};font-size:16px;font-weight:bold;color:${C.ink};">Volunteer Resources</p>
${button("Join the WhatsApp Group", WHATSAPP_GROUP_URL)}
${outlineButton("Volunteer Guidelines", GUIDELINES_URL)}`;
}

/** Dress code and check-in notice, shown in every reminder and the event email. */
function arrivalHtml(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:${C.footerBg};border-radius:8px;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0;"><strong style="color:${C.ink};">Dress code:</strong> ${esc(DRESS_CODE)}</p>
    <p style="margin:8px 0 0;"><strong style="color:${C.ink};">Check-in:</strong> ${esc(CHECK_IN)}</p>
  </td></tr>
</table>`;
}

function resourcesText(): string {
  return ["Volunteer Resources:", `- Join the WhatsApp Group: ${WHATSAPP_GROUP_URL}`, `- Volunteer Guidelines: ${GUIDELINES_URL}`].join("\n");
}

function arrivalText(): string {
  return `Dress code: ${DRESS_CODE}\nCheck-in: ${CHECK_IN}`;
}

const SIGN_OFF_1 = "Thank you for your time, devotion, and selfless service,";
const SIGN_OFF_2 = "ISKCON 60th Anniversary Gala Organizing Team.";

/** Closing lines at the end of each reminder and the event email. */
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
  return `${s.department}: ${s.title}\n${formatDay(s.start_time)}, ${formatRange12(s.start_time, s.end_time)}`;
}

/* ---------------------------------------------------------------------------
 * Booking emails (sent when a shift is booked or removed)
 * ------------------------------------------------------------------------- */

export function renderBookingConfirmed(p: ShiftEmailPayload): RenderedEmail {
  const day = formatDay(p.start_time);
  const subject = `You're booked: ${p.title}, ${day}`;
  const heading = "Your shift is confirmed";
  const bodyHtml = `<p>Dear ${esc(displayName(p.full_name))},</p>
<p>You are confirmed for the shift below.</p>
${shiftCard(p)}
<p>Please arrive at least 15 minutes early and check in with the volunteer coordinator.</p>
${resourcesHtml()}`;
  return {
    subject,
    html: layout({ preheader: `Confirmed: ${p.title}, ${day}`, heading, bodyHtml }),
    text: `Dear ${displayName(p.full_name)},

You are confirmed for:
${shiftText(p)}

Please arrive at least 15 minutes early and check in with the volunteer coordinator.

${resourcesText()}
${contactsText()}`,
  };
}

export function renderBookingCancelled(p: ShiftEmailPayload): RenderedEmail {
  const day = formatDay(p.start_time);
  const subject = `Your shift was cancelled: ${p.title}, ${day}`;
  const heading = "Shift cancelled";
  const bodyHtml = `<p>Dear ${esc(displayName(p.full_name))},</p>
<p>The shift below is no longer on your schedule.</p>
${shiftCard(p)}
<p>If you still want to volunteer, please pick another shift in the volunteer dashboard.</p>
<p>${button("Go to Volunteer Dashboard", DASHBOARD_URL)}</p>
${resourcesHtml()}`;
  return {
    subject,
    html: layout({ preheader: `Removed: ${p.title}, ${day}`, heading, bodyHtml }),
    text: `Dear ${displayName(p.full_name)},

The shift below is no longer on your schedule:
${shiftText(p)}

If you still want to volunteer, please pick another shift in the volunteer dashboard:
${DASHBOARD_URL}

${resourcesText()}
${contactsText()}`,
  };
}

/* ---------------------------------------------------------------------------
 * Shift reminders: morning (today 4 PM) and later shifts (7 AM on the day).
 * One email per volunteer, listing every upcoming shift they hold.
 * ------------------------------------------------------------------------- */

export function renderShiftReminder(p: ReminderPayload): RenderedEmail {
  const shifts = [...p.shifts].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const first = shifts[0];
  const many = shifts.length > 1;
  const name = displayName(p.full_name);
  const subject = many
    ? `Reminder: your ${shifts.length} volunteer shifts, ${formatDay(first.start_time)}`
    : `Reminder: ${first.title}, ${formatDay(first.start_time)} at ${formatTime12(first.start_time)}`;
  const heading = many ? "Your upcoming shifts" : "Your upcoming shift";
  const bodyHtml = `<p style="font-family:${SERIF};font-size:17px;color:${C.ink};margin:0 0 16px;">Hare Krishna, ${esc(name)}</p>
<p>${esc(THANK_YOU)}</p>
<p>${esc(SUPPORT)}</p>
<p>This is a reminder of your upcoming volunteer ${many ? "shifts" : "shift"}.</p>
${shifts.map(shiftCard).join("")}
<p>${esc(PREPARE)}</p>
${arrivalHtml()}
${resourcesHtml()}
<p style="margin:24px 0 8px;"><strong style="color:${C.ink};">Plans changed?</strong> If you cannot make ${many ? "these shifts" : "this shift"}, please let a volunteer coordinator know as soon as possible, and/or update your shifts in the volunteer dashboard.</p>
<p style="margin:10px 0 0;">${button("Go to Volunteer Dashboard", DASHBOARD_URL)}</p>
${signOffHtml()}`;
  return {
    subject,
    html: layout({ preheader: `Your volunteer ${many ? "shifts" : "shift"}: ${first.title}`, heading, bodyHtml }),
    text: `Hare Krishna, ${name}

${THANK_YOU}
${SUPPORT}

This is a reminder of your upcoming volunteer ${many ? "shifts" : "shift"}:

${shifts.map(shiftText).join("\n\n")}

${PREPARE}

${arrivalText()}

${resourcesText()}

Plans changed? If you cannot make ${many ? "these shifts" : "this shift"}, please let a volunteer coordinator know as soon as possible, and/or update your shifts in the volunteer dashboard:
${DASHBOARD_URL}

${SIGN_OFF_1}
${SIGN_OFF_2}
${contactsText()}`,
  };
}

/* ---------------------------------------------------------------------------
 * Event email: registered volunteers with no shift (7 AM on the gala day).
 * Same format as the reminders. The middle section will carry the custom
 * times the volunteers gave; until then it keeps the approved wording.
 * ------------------------------------------------------------------------- */

export function renderEventEmail(p: { full_name: string }): RenderedEmail {
  const name = displayName(p.full_name);
  const subject = "ISKCON 60th Gala: please choose your volunteer roles today";
  const heading = "Choose your volunteer roles";
  const middle =
    "We noticed that you have not yet chosen your roles or departments. Please note that role assignments close tonight. If you haven't done so yet, please sign in to the volunteer dashboard and select your preferred roles and departments.";
  const bodyHtml = `<p style="font-family:${SERIF};font-size:17px;color:${C.ink};margin:0 0 16px;">Hare Krishna, ${esc(name)}</p>
<p>${esc(THANK_YOU)}</p>
<p>${esc(SUPPORT)}</p>
<p>${esc(middle)}</p>
<p style="margin:10px 0 0;">${button("Go to Volunteer Dashboard", DASHBOARD_URL)}</p>
<p>${esc(PREPARE)}</p>
${arrivalHtml()}
${resourcesHtml()}
<p style="margin-top:24px;">If you encounter any issues or face errors while submitting your preferences, please send us an email and we will resolve it promptly.</p>
${signOffHtml()}`;
  const text = `Hare Krishna, ${name}

${THANK_YOU}
${SUPPORT}

${middle}
${DASHBOARD_URL}

${PREPARE}

${arrivalText()}

${resourcesText()}

If you encounter any issues or face errors while submitting your preferences, please send us an email and we will resolve it promptly.

${SIGN_OFF_1}
${SIGN_OFF_2}
${contactsText()}`;
  return {
    subject,
    html: layout({ preheader: "Please choose your volunteer roles", heading, bodyHtml }),
    text,
  };
}

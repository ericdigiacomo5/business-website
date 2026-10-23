import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { PolicyPage, PolicySection } from "@/components/legal/policy-page"
import { LEGAL_CONTACT, PRIVACY_LAST_UPDATED, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
    title: `Privacy Policy | ${SITE_NAME}`,
    description: `How ${SITE_NAME} collects, uses and protects your information.`,
}

// The client's privacy policy, generated with Termly (2026-10-22), in the
// site's own layout. Where to look before changing it:
//   - Termly's generated wording is kept as written, including its section
//     ids (#infocollect, #whoshare, ...).
//   - Added from Termly's own standard clauses, to match what the app does:
//     the service-provider clause (§3), "information automatically
//     collected", the cookies section (§4), and the extra processing
//     purposes (§2).
//   - §5 "Text Messages" uses the standard carrier/10DLC privacy wording
//     (Twilio's A2P 10DLC guidance, CTIA). Reviewers look for its sharing
//     sentences word for word, so don't reword them.
//   - Fixed generator glitches: the blank state name in §11, the "marketing
//     or events" line, and the "internal research … demonstration" line.
//   - Client choices (Eric, 2026-10-22), each using the matching Termly
//     template option: retention is "seven (7) years past the termination
//     of the user's account" (§6 and §11's category list; their accountant
//     should confirm); data requests are by email only (the Termly-hosted
//     form was removed); the contact email stays the Yahoo address in
//     LEGAL_CONTACT (site.ts); the minimum age is 18, matching the terms.
// Change any wording? Update PRIVACY_LAST_UPDATED in src/lib/site.ts.

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nailimageinc.com"

const link = "text-accent underline underline-offset-2"

function InShort({ children }: { children: ReactNode }) {
    return (
        <p className="italic">
            <span className="font-semibold not-italic text-foreground">In Short: </span>
            {children}
        </p>
    )
}

function List({ items }: { items: ReactNode[] }) {
    return (
        <ul className="list-disc space-y-2 pl-5">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ul>
    )
}

function Term({ children }: { children: ReactNode }) {
    return <span className="font-semibold text-foreground">{children}</span>
}

function Email() {
    return (
        <a href={`mailto:${LEGAL_CONTACT.email}`} className={link}>
            {LEGAL_CONTACT.email}
        </a>
    )
}

const TOC: [string, string][] = [
    ["infocollect", "1. What Information Do We Collect?"],
    ["infouse", "2. How Do We Process Your Information?"],
    ["whoshare", "3. When and With Whom Do We Share Your Personal Information?"],
    ["cookies", "4. Do We Use Cookies and Other Tracking Technologies?"],
    ["sms", "5. Text Messages"],
    ["inforetain", "6. How Long Do We Keep Your Information?"],
    ["infosafe", "7. How Do We Keep Your Information Safe?"],
    ["infominors", "8. Do We Collect Information From Minors?"],
    ["privacyrights", "9. What Are Your Privacy Rights?"],
    ["DNT", "10. Controls for Do-Not-Track Features"],
    ["uslaws", "11. Do United States Residents Have Specific Privacy Rights?"],
    ["policyupdates", "12. Do We Make Updates to This Notice?"],
    ["contact", "13. How Can You Contact Us About This Notice?"],
    ["request", "14. How Can You Review, Update, or Delete the Data We Collect From You?"],
]

const heading = (id: string) => TOC.find(([key]) => key === id)![1]

// Section 11's table of categories, as generated. "Collected" is YES for
// identifiers (incl. IP address, which request logs hold) and commercial
// information (bookings, store credit).
const CATEGORIES: [string, string, boolean][] = [
    [
        "A. Identifiers",
        "Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name",
        true,
    ],
    [
        "B. Protected classification characteristics under state or federal law",
        "Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data",
        false,
    ],
    ["C. Commercial information", "Transaction information, purchase history, financial details, and payment information", true],
    ["D. Biometric information", "Fingerprints and voiceprints", false],
    [
        "E. Internet or other similar network activity",
        "Browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements",
        false,
    ],
    ["F. Geolocation data", "Device location", false],
    [
        "G. Audio, electronic, sensory, or similar information",
        "Images and audio, video or call recordings created in connection with our business activities",
        false,
    ],
    [
        "H. Professional or employment-related information",
        "Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us",
        false,
    ],
    ["I. Education Information", "Student records and directory information", false],
    [
        "J. Inferences drawn from collected personal information",
        "Inferences drawn from any of the collected personal information listed above to create a profile or summary about, for example, an individual's preferences and characteristics",
        false,
    ],
    ["K. Sensitive personal Information", "", false],
]

export default function PrivacyPage() {
    return (
        <PolicyPage title="Privacy Policy" lastUpdated={PRIVACY_LAST_UPDATED}>
            <section className="space-y-3">
                <p>
                    {`This Privacy Notice for ${SITE_NAME} ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:`}
                </p>
                <List
                    items={[
                        <>
                            {"Visit our website at "}
                            <a href={SITE_URL} className={link}>
                                {SITE_URL}
                            </a>
                            {" or any website of ours that links to this Privacy Notice"}
                        </>,
                        "Book, change, or cancel an appointment, or receive appointment emails or text messages from us",
                        "Engage with us in other related ways",
                    ]}
                />
                <p>
                    <Term>Questions or concerns? </Term>
                    {"Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at "}
                    <Email />.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="font-serif text-2xl font-extrabold text-foreground">Summary of Key Points</h2>
                <p className="italic">
                    {"This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our "}
                    <a href="#toc" className={link}>
                        table of contents
                    </a>
                    {" below to find the section you are looking for."}
                </p>
                <p>
                    <Term>What personal information do we process? </Term>
                    {"When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about "}
                    <a href="#infocollect" className={link}>
                        personal information you disclose to us
                    </a>
                    .
                </p>
                <p>
                    <Term>Do we process any sensitive personal information? </Term>
                    {'Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.'}
                </p>
                <p>
                    <Term>Do we collect any information from third parties? </Term>
                    We do not collect any information from third parties.
                </p>
                <p>
                    <Term>How do we process your information? </Term>
                    {"We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about "}
                    <a href="#infouse" className={link}>
                        how we process your information
                    </a>
                    .
                </p>
                <p>
                    <Term>In what situations and with which parties do we share personal information? </Term>
                    {"We may share information in specific situations and with specific third parties. Learn more about "}
                    <a href="#whoshare" className={link}>
                        when and with whom we share your personal information
                    </a>
                    .
                </p>
                <p>
                    <Term>How do we keep your information safe? </Term>
                    {"We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about "}
                    <a href="#infosafe" className={link}>
                        how we keep your information safe
                    </a>
                    .
                </p>
                <p>
                    <Term>What are your rights? </Term>
                    {"Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about "}
                    <a href="#privacyrights" className={link}>
                        your privacy rights
                    </a>
                    .
                </p>
                <p>
                    <Term>How do you exercise your rights? </Term>
                    {"The easiest way to exercise your rights is by contacting us at "}
                    <Email />
                    {". We will consider and act upon any request in accordance with applicable data protection laws."}
                </p>
                <p>
                    {"Want to learn more about what we do with any information we collect? "}
                    <a href="#toc" className={link}>
                        Review the Privacy Notice in full
                    </a>
                    .
                </p>
            </section>

            <section id="toc" className="scroll-mt-24">
                <h2 className="font-serif text-2xl font-extrabold text-foreground">Table of Contents</h2>
                <ol className="mt-3 space-y-1">
                    {TOC.map(([id, label]) => (
                        <li key={id}>
                            <a href={`#${id}`} className={`${link} inline-flex min-h-11 items-center sm:min-h-0`}>
                                {label}
                            </a>
                        </li>
                    ))}
                </ol>
            </section>

            <PolicySection id="infocollect" heading={heading("infocollect")}>
                <h3 id="personalinfo" className="font-semibold text-foreground">
                    Personal information you disclose to us
                </h3>
                <InShort>We collect personal information that you provide to us.</InShort>
                <p>
                    We collect personal information that you voluntarily provide to us when you register on the
                    Services, express an interest in obtaining information about us or our products and Services,
                    when you participate in activities on the Services, or otherwise when you contact us.
                </p>
                <p>
                    <Term>Personal Information Provided by You. </Term>
                    {"The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:"}
                </p>
                <List
                    items={[
                        "names",
                        "phone numbers",
                        "email addresses",
                        "passwords",
                        "appointment bookings and history (services, artist, date and time, and visit records)",
                        "store credit and gift card balances and history",
                        "text message (SMS) opt-in and opt-out records, if you choose to receive text messages",
                    ]}
                />
                <p>
                    <Term>Sensitive Information. </Term>
                    We do not process sensitive information.
                </p>
                <p>
                    All personal information that you provide to us must be true, complete, and accurate, and you must
                    notify us of any changes to such personal information.
                </p>

                <h3 className="pt-2 font-semibold text-foreground">Information automatically collected</h3>
                <InShort>
                    Some information — such as your Internet Protocol (IP) address and/or browser and device
                    characteristics — is collected automatically when you visit our Services.
                </InShort>
                <p>
                    We automatically collect certain information when you visit, use, or navigate the Services. This
                    information does not reveal your specific identity (like your name or contact information) but may
                    include device and usage information, such as your IP address, browser and device
                    characteristics, operating system, referring URLs, and information about how and when you use our
                    Services. This information is primarily needed to maintain the security and operation of our
                    Services.
                </p>
                <p>
                    <Term>Log and Usage Data. </Term>
                    {"Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages and files viewed, and other actions you take such as which features you use), device event information (such as system activity and error reports), and hardware settings."}
                </p>
            </PolicySection>

            <PolicySection id="infouse" heading={heading("infouse")}>
                <InShort>
                    We process your information to provide, improve, and administer our Services, communicate with
                    you, for security and fraud prevention, and to comply with law. We may also process your
                    information for other purposes with your consent.
                </InShort>
                <p>
                    We process your personal information for a variety of reasons, depending on how you interact with
                    our Services, including:
                </p>
                <List
                    items={[
                        <>
                            <Term>To facilitate account creation and authentication and otherwise manage user accounts. </Term>
                            We may process your information so you can create and log in to your account, as well as keep
                            your account in working order.
                        </>,
                        <>
                            <Term>To deliver and facilitate delivery of services to the user. </Term>
                            We may process your information to provide you with the requested service.
                        </>,
                        <>
                            <Term>To send administrative information to you. </Term>
                            {"We may process your information to send you details about our products and services, changes to our terms and policies, and other similar information. This includes appointment confirmations, reminders, changes, cancellations, and receipts, sent by email and, if you opt in, by text message."}
                        </>,
                        <>
                            <Term>To protect our Services. </Term>
                            We may process your information as part of our efforts to keep our Services safe and secure,
                            including fraud monitoring and prevention.
                        </>,
                        <>
                            <Term>To comply with our legal obligations. </Term>
                            {"We may process your information to comply with our legal obligations, respond to legal requests, and exercise, establish, or defend our legal rights."}
                        </>,
                    ]}
                />
            </PolicySection>

            <PolicySection id="whoshare" heading={heading("whoshare")}>
                <InShort>
                    We may share information in specific situations described in this section and/or with the
                    following third parties.
                </InShort>
                <p>
                    <Term>Vendors, Consultants, and Other Third-Party Service Providers. </Term>
                    {'We may share your data with third-party vendors, service providers, contractors, or agents ("third parties") who perform services for us or on our behalf and require access to such information to do that work. We have contracts in place with our third parties, which are designed to help safeguard your personal information. This means that they cannot do anything with your personal information unless we have instructed them to do it. They will also not share your personal information with any organization apart from us. They also commit to protect the data they hold on our behalf and to retain it for the period we instruct.'}
                </p>
                <p>The third parties we may share personal information with are as follows:</p>
                <List
                    items={[
                        <>
                            <Term>Website hosting and security: </Term>Cloudflare
                        </>,
                        <>
                            <Term>Database hosting: </Term>Neon
                        </>,
                        <>
                            <Term>Email delivery: </Term>Resend
                        </>,
                        <>
                            <Term>Text message delivery: </Term>Twilio (only if you opt in to text messages)
                        </>,
                        <>
                            <Term>Image hosting: </Term>Cloudinary (photos of our artists and their work)
                        </>,
                    ]}
                />
                <p>We also may need to share your personal information in the following situations:</p>
                <List
                    items={[
                        <>
                            <Term>Business Transfers. </Term>
                            We may share or transfer your information in connection with, or during negotiations of, any
                            merger, sale of company assets, financing, or acquisition of all or a portion of our business
                            to another company.
                        </>,
                    ]}
                />
            </PolicySection>

            <PolicySection id="cookies" heading={heading("cookies")}>
                <InShort>We use a cookie that is strictly necessary to keep you signed in.</InShort>
                <p>
                    Some online tracking technologies help us maintain the security of our Services and your account,
                    prevent crashes, fix bugs, save your preferences, and assist with basic site functions. We use one
                    strictly necessary cookie to keep you signed in to your account. We do not use cookies or similar
                    technologies for analytics or advertising, and we do not allow third parties to place tracking
                    technologies on our Services.
                </p>
            </PolicySection>

            <PolicySection id="sms" heading={heading("sms")}>
                <InShort>Text messages are optional, and we never share your mobile number for marketing.</InShort>
                <p>
                    {"If you opt in to appointment text messages, we collect your mobile phone number and a record of your consent (when you opted in, confirmed, and opted out, and the wording you agreed to), and we keep a record of the messages we send you. We use this information only to send the appointment messages you asked for. Our messaging provider, Twilio, delivers these messages on our behalf. You can opt out at any time by replying STOP to any message, or on your "}
                    <Link href="/account" className={link}>
                        My Account
                    </Link>
                    {" page. See our "}
                    <Link href="/terms#sms" className={link}>
                        Terms
                    </Link>
                    {" for details of our text message program."}
                </p>
                <p className="font-medium text-foreground">
                    No mobile information will be shared with third parties or affiliates for marketing or promotional
                    purposes. Information sharing to subcontractors in support services, such as customer service, is
                    permitted. All other use case categories exclude text messaging originator opt-in data and
                    consent; this information will not be shared with any third parties.
                </p>
            </PolicySection>

            <PolicySection id="inforetain" heading={heading("inforetain")}>
                <InShort>
                    We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy
                    Notice unless otherwise required by law.
                </InShort>
                <p>
                    {"We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than seven (7) years past the termination of the user's account."}
                </p>
                <p>
                    {"When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible."}
                </p>
            </PolicySection>

            <PolicySection id="infosafe" heading={heading("infosafe")}>
                <InShort>
                    We aim to protect your personal information through a system of organizational and technical
                    security measures.
                </InShort>
                <p>
                    {"We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment."}
                </p>
            </PolicySection>

            <PolicySection id="infominors" heading={heading("infominors")}>
                <InShort>We do not knowingly collect data from or market to children under 18 years of age.</InShort>
                <p>
                    {"We do not knowingly collect, solicit data from, or market to children under 18 years of age, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent's use of the Services. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18, please contact us at "}
                    <Email />.
                </p>
            </PolicySection>

            <PolicySection id="privacyrights" heading={heading("privacyrights")}>
                <InShort>
                    You may review, change, or terminate your account at any time, depending on your country,
                    province, or state of residence.
                </InShort>
                <p>
                    <Term>Withdrawing your consent: </Term>
                    {"If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section "}
                    <a href="#contact" className={link}>
                        {`"${heading("contact").replace(/^\d+\. /, "")}"`}
                    </a>
                    {" below."}
                </p>
                <p>
                    However, please note that this will not affect the lawfulness of the processing before its
                    withdrawal nor, when applicable law allows, will it affect the processing of your personal
                    information conducted in reliance on lawful processing grounds other than consent.
                </p>
                <h3 className="pt-2 font-semibold text-foreground">Account Information</h3>
                <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
                <List
                    items={[
                        <>
                            {"Log in to your "}
                            <Link href="/account" className={link}>
                                account settings
                            </Link>
                            {" and update your user account."}
                        </>,
                        "Contact us using the contact information provided.",
                    ]}
                />
                <p>
                    {"Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements."}
                </p>
                <p>
                    {"If you have questions or comments about your privacy rights, you may email us at "}
                    <Email />.
                </p>
            </PolicySection>

            <PolicySection id="DNT" heading={heading("DNT")}>
                <p>
                    {'Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.'}
                </p>
                <p>
                    California law requires us to let you know how we respond to web browser DNT signals. Because
                    there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do
                    not respond to them at this time.
                </p>
            </PolicySection>

            <PolicySection id="uslaws" heading={heading("uslaws")}>
                <InShort>
                    {"If you are a resident of certain US states, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. More information is provided below."}
                </InShort>
                <h3 className="pt-2 font-semibold text-foreground">Categories of Personal Information We Collect</h3>
                <p>
                    {"The table below shows the categories of personal information we have collected in the past twelve (12) months. The table includes illustrative examples of each category and does not reflect the personal information we collect from you. For a comprehensive inventory of all personal information we process, please refer to the section "}
                    <a href="#infocollect" className={link}>
                        {`"${heading("infocollect").replace(/^\d+\. /, "")}"`}
                    </a>
                    .
                </p>
                <div className="overflow-x-auto rounded-md border border-line">
                    <table className="w-full min-w-lg text-left text-sm">
                        <thead className="bg-cream text-foreground">
                            <tr>
                                <th className="p-3 font-semibold">Category</th>
                                <th className="p-3 font-semibold">Examples</th>
                                <th className="p-3 font-semibold">Collected</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CATEGORIES.map(([category, examples, collected]) => (
                                <tr key={category} className="border-t border-line align-top">
                                    <td className="p-3 font-medium text-foreground">{category}</td>
                                    <td className="p-3">{examples}</td>
                                    <td className="p-3 font-semibold">{collected ? "YES" : "NO"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p>
                    We may also collect other personal information outside of these categories through instances where
                    you interact with us in person, online, or by phone or mail in the context of:
                </p>
                <List
                    items={[
                        "Receiving help through our customer support channels;",
                        "Participation in customer surveys or contests; and",
                        "Facilitation in the delivery of our Services and to respond to your inquiries.",
                    ]}
                />
                <p>We will use and retain the collected personal information as needed to provide the Services or for:</p>
                <List
                    items={[
                        "Category A - Seven (7) years past the termination of the user's account",
                        "Category C - Seven (7) years past the termination of the user's account",
                    ]}
                />

                <h3 className="pt-2 font-semibold text-foreground">Sources of Personal Information</h3>
                <p>
                    {"Learn more about the sources of personal information we collect in "}
                    <a href="#infocollect" className={link}>
                        {`"${heading("infocollect").replace(/^\d+\. /, "")}"`}
                    </a>
                    .
                </p>

                <h3 className="pt-2 font-semibold text-foreground">How We Use and Share Personal Information</h3>
                <p>
                    {"Learn more about how we use your personal information in the section, "}
                    <a href="#infouse" className={link}>
                        {`"${heading("infouse").replace(/^\d+\. /, "")}"`}
                    </a>
                    .
                </p>
                <p>
                    <Term>Will your information be shared with anyone else?</Term>
                </p>
                <p>
                    {"We may disclose your personal information with our service providers pursuant to a written contract between us and each service provider. Learn more about how we disclose personal information in the section, "}
                    <a href="#whoshare" className={link}>
                        {`"${heading("whoshare").replace(/^\d+\. /, "")}"`}
                    </a>
                    .
                </p>
                <p>
                    {"We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (12) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers."}
                </p>

                <h3 className="pt-2 font-semibold text-foreground">Your Rights</h3>
                <p>
                    You have rights under certain US state data protection laws. However, these rights are not
                    absolute, and in certain cases, we may decline your request as permitted by law. These rights
                    include:
                </p>
                <List
                    items={[
                        "Right to know whether or not we are processing your personal data",
                        "Right to access your personal data",
                        "Right to correct inaccuracies in your personal data",
                        "Right to request the deletion of your personal data",
                        "Right to obtain a copy of the personal data you previously shared with us",
                        "Right to non-discrimination for exercising your rights",
                        'Right to opt out of the processing of your personal data if it is used for targeted advertising, the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects ("profiling")',
                    ]}
                />

                <h3 className="pt-2 font-semibold text-foreground">How to Exercise Your Rights</h3>
                <p>
                    {"To exercise these rights, you can contact us by emailing us at "}
                    <Email />
                    {", or by referring to the contact details at the bottom of this document."}
                </p>
                <p>
                    {"Under certain US state data protection laws, you can designate an authorized agent to make a request on your behalf. We may deny a request from an authorized agent that does not submit proof that they have been validly authorized to act on your behalf in accordance with applicable laws."}
                </p>

                <h3 className="pt-2 font-semibold text-foreground">Request Verification</h3>
                <p>
                    {"Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request. However, if we cannot verify your identity from the information already maintained by us, we may request that you provide additional information for the purposes of verifying your identity and for security or fraud-prevention purposes."}
                </p>
                <p>
                    {"If you submit the request through an authorized agent, we may need to collect additional information to verify your identity before processing your request and the agent will need to provide a written and signed permission from you to submit such request on your behalf."}
                </p>
            </PolicySection>

            <PolicySection id="policyupdates" heading={heading("policyupdates")}>
                <InShort>Yes, we will update this notice as necessary to stay compliant with relevant laws.</InShort>
                <p>
                    {'We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Last updated" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.'}
                </p>
            </PolicySection>

            <PolicySection id="contact" heading={heading("contact")}>
                <p>
                    {"If you have questions or comments about this notice, you may email us at "}
                    <Email />
                    {" or contact us by post at:"}
                </p>
                <address className="not-italic">
                    {LEGAL_CONTACT.postalLines.map((line) => (
                        <span key={line} className="block">
                            {line}
                        </span>
                    ))}
                </address>
            </PolicySection>

            <PolicySection id="request" heading={heading("request")}>
                <p>
                    {"Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please contact us at "}
                    <Email />.
                </p>
            </PolicySection>

            <p className="text-sm text-muted-foreground">
                {"This Privacy Policy was created using Termly's "}
                <a href="https://termly.io/products/privacy-policy-generator/" className="underline underline-offset-2" rel="noopener noreferrer">
                    Privacy Policy Generator
                </a>
                .
            </p>
        </PolicyPage>
    )
}

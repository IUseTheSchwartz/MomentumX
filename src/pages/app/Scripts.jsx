import { useMemo, useState } from 'react';

const SCRIPTS = [
  {
    title: 'Logan Harris IUL Script',
    type: 'IUL',
    content: `IUL SCRIPT — PART 1: OPENING + QUALIFICATION FRAME

1. Opener: Why They Clicked (Permission + Curiosity)

“Hey [Name], this is Sam. You had filled out a form online looking for information on an Indexed Universal Life policy.

Before we jump in, I’m just curious — what was it specifically that caught your attention when you clicked on the ad or filled out the form?”

(Let them talk. Whatever they say becomes your ammo later.)

2. Set the Frame: Time + Qualification

“Got it. That makes sense.

So here’s how I like to start these calls — I just want to make sure I can even qualify you for this type of program upfront.

The reason I do that is simple: if it’s not a fit, I don’t want to waste your time or mine. Fair enough?”

3. Health Disqualifying Questions

“Perfect. I’m going to run through these pretty quickly.”

Health History

“Have you ever been diagnosed with or treated for:

• A heart attack or heart disease?
• Stroke or TIA?
• Diabetes — Type 1 or Type 2?
• Cancer of any kind?
• COPD or other lung disease?
• Liver or kidney disease?”

Mental Health

“Any major mental health diagnoses?

Anxiety or depression is fine — I’m talking more about bipolar disorder, schizophrenia, things like that.”

Medications

“Roughly how many prescription medications are you on right now?”

Lifestyle / Basics

“Do you have a valid driver’s license?”

“If no driver’s license, do you have a valid state ID?”

“Any felonies or misdemeanors in the last 10 years?”

“What’s your height and weight?”

“And what’s your date of birth?”

If bad health:

“Okay, so I hope you can appreciate this, but I want to be fully transparent with you upfront. With _____ x years ago, there’s a smaller chance you’ll be approved for their aggressive version, but I’m certain we can get you approved for the conservative version.”

4. Knowledge Calibration

“Perfect. Based on what you shared, you should be eligible — final approval always comes from underwriting, but nothing you said raises any red flags so far.”

“Let me ask you this real quick — on a scale of 1 to 10, how familiar would you say you are with how an IUL actually works?

One being ‘I just saw an ad,’ ten being ‘I could explain it myself.’”

5. Transition to Education

“Got it. That’s actually pretty normal.

I’ll tell ya what, it’s important to me that if you’re going to invest in something for yourself and your family, you really understand what you’re investing in.

So I’m going to take the next minute to break this down in depth.

The easiest way to understand this is to break it into three main buckets.

Those three buckets are:

1. The death benefit
2. The cash value
3. The living benefits”

PART 2: BUCKET #1 — THE DEATH BENEFIT

“So the first bucket is the death benefit — and this is the part that makes the policy even exist in the first place.”

“At its core, this is life insurance. If something happens to you, your family receives a tax-free lump sum.”

“That money can be used for:

• Paying off the mortgage
• Replacing income
• Covering final expenses
• Making sure your family isn’t financially stressed”

“With term, you rent coverage for 20 or 30 years. If you outlive it — which most people do — it expires and you get nothing back.”

“With an IUL, this coverage is permanent. As long as the policy is funded properly, it stays in place for your entire life.”

PART 3: BUCKET #2 — CASH VALUE

“The second bucket — and the one most people are really interested in — is the cash value.”

“Every dollar you put into the policy is split:

• Part pays for the insurance
• The rest goes into a cash value account that grows over time at an 8–12% rate”

“I mean, what does our savings account do, like 1% if we’re lucky?”

“That cash value is linked to the performance of major market indexes — like the S&P 500 — without actually being invested in the market.”

“So here’s the key part:

• When the market goes up, you participate in the gains
• When the market goes down, you don’t lose money”

“You have a floor, usually at zero — meaning no market losses — and a cap on the upside.”

“Over time, that cash value can be used for:

• Retirement income
• Emergency funds
• Big purchases
• Opportunities
• Tax-advantaged savings”

“And unlike a 401(k) or IRA:

• There are no contribution limits
• No required retirement age
• No penalties for accessing your money”

PART 4: BUCKET #3 — LIVING BENEFITS

“The third bucket is what most people don’t realize comes with these policies — living benefits.”

“This allows you to access part of the death benefit while you’re still alive if something serious happens.”

“That includes:

• Cancer
• Heart attack
• Stroke
• Chronic illness
• Terminal illness”

“Instead of being forced to drain savings, sell assets, or rely on family — you can access money from your policy.”

“That money is tax-free and can be used however you want.”

PART 5: RECAP → SOFT CLOSE → NEXT STEPS

“So if we zoom out, here’s the big picture:

• Bucket one protects your family
• Bucket two builds tax-advantaged wealth
• Bucket three protects you while you’re alive”

“Does this product align with your vision on _____?”

“Perfect — that tells me we’re aligned then.”

“So from here, the next step is really simple.

All we’re doing now is making sure the insurance company agrees that you qualify for what we just went over.”

“Most people I help usually contribute somewhere between $___ and $___ per month, depending on how aggressive they want the growth.

Where do you feel most comfortable landing?”

APPLICATION TRANSITION

“Okay, I’ll pull up the application now. The company we’ll be going through is Mutual of Omaha. I’m sure you’ve heard of them, right? They’ve been around for over 100 years and have a great IUL product for someone in your position.”

“Okay, confirm the spelling of your first and last name.”

“Confirm the DOB for me one more time.”

“What state are you out of?”

“Is this cell we’re talking on a good primary number to put on this policy?”

“And then I think I have the email here, is it _____?”

“And then you said the height and weight was _____?”

“If you were to be approved, what’s a good address we can send the paper policy out to?”

“Is that a house or apartment?”

“What’s a good social to attach to the policy?”

“Do I have permission to read that back to you?”

MUTUAL TEXT CODE

“Now, I’m assuming you’ve heard of HIPAA, right?”

“Perfect. Mutual is just going to send you over a text message for HIPAA stating that all your information is protected in their application here. It’ll be from an 844 number. Just let me know when you got that.”

“Perfect. You’re going to click on the link. Once you do, there may be a popup blocker. You’ll just hit allow. Then you’ll enter the last 4 of your social to log in. Once you log in, you’ll see a box you’ll need to click that says I agree, and that’ll allow me to move forward.”

LICENSE / PROPOSED INSURED

“You said you had a valid driver’s license, right?”

“Perfect, and I’m assuming that’s issued out of _____?”

“Were you born in _____?”

“I’ll go ahead and take down that license number when you’re ready.”

EMPLOYMENT

“Are you currently employed?”

“If yes, what’s a good job title for you?”

“They do make me ask — I don’t need an exact number, just ballpark, what do you bring in annually?”

MORE HEALTH QUESTIONS

“Now they do make me ask a few more health questions. Just answer truthfully for me, okay?”

“Any HIV or AIDS? Any lung disease or schizophrenia? Any kidney disease or cancer? Any lupus or organ transplants? Do you require any sort of physical help getting dressed or eating daily?”

BENEFICIARY

“Who do you want down as your beneficiary for your policy?”

Fill out information and confirm it back.

PAYMENT AND START DATE

“Just to confirm, we’re doing the initial investment of _____ correct?”

“Perfect. The carriers typically prefer the initial premium to start within the next 24–48 hours, that way God forbid something were to happen to you, you’re covered. Is that comfortable for you or is there a better day in the current month?”

“Would that be coming out of savings or checking?”

“Mutual is pretty good about this. Just to confirm they work with your bank, what’s the name of the bank you’re with?”

“Perfect, they do work with them because they provide me with the routing number. It looks like it starts with _____. Go ahead and grab something so I can read this to you to confirm it’s the right one.”

“And then the account number?”

FINAL TEXT CODE

“Mutual is going to send you one last text here. It’ll be from the same 844 number. It’ll be a new link we’ll have to sign, and then I can send this in for you.”

“You’ll click the new link and enter the last 4 of your social. Once logged in, scroll to the bottom and you’ll see something that says sign with your finger. It seems easier if you hit no and just type your full name in the box. Once you do, hit capture, and then I can submit this on my end and hopefully get you that good news.”

SUBMIT APP

If approved, give good news, policy packet details, etc.

If not, explain medical underwriting and pivot.`
  },
  {
    title: 'VET Script',
    type: 'Veteran Final Expense',
    content: `+READ THIS EVERYDAY

Focus on the skill. Money is a byproduct. Hall of Fame or die. Discipline & Repetition pays out.

Dial every second of the day. Be stingy with your time.

Keep your standards. Accountability. Focused intention all day. Treat it like a business.

Confidence. Pattern interruption. Trigger avoidance. Hone in on your skills. Stand out.

INTRO

“Hey (client)... Hey (client), this is (your first name).”

“I was just getting back to you in regards to the life and final expense options for veterans.”

“I have a date of birth here as _____, is that correct?”

“And you still reside in the state of _____, correct?”

“And you are an honorably discharged veteran, correct? Thank you for your service.”

“Now your main concern was just wanting to make sure funeral expenses don't fall burden on your loved ones?”

Mirror, rapport, agree.

If has coverage: Jump to “Has Coverage Sheet.”

If no coverage: Dig into why.

DIG INTO WHY

“Now God forbid, if anything were to happen to you today, who would be the beneficiary responsible for paying for the funeral expenses?”

“What’s his/her name? Spell that out for me.”

“Have you thought about whether you were to be buried or cremated?”

“Okay, and do you have anything (beneficiary name) can use to cover the funeral costs?”

“Got it, so you just want to make sure (beneficiary name) doesn’t have to go into any debt or any financial burden, correct? I completely understand.”

“Do you know how much that costs nowadays?”

“In the state of (state name), an average cremation costs 5–7k depending on celebration/urn.”

“Burial costs 10–15k depending on the service and opening/closing.”

ASSUME CLOSE

“So what we’re going to do is spend a minute on your health and see what we can get you pre-qualified for. We’ll send in the request, and if we get you approved, you’ll set it to your preferred draft date to go into effect. Alright?”

HEALTH

“For all of your medical needs, do you go to the VA or a civilian doctor?”

“Are all of your prescriptions prescribed through the VA or a civilian doctor?”

“Are you a smoker or non-smoker? Any plans to quit?”

“Any heart attacks, heart failure, strokes, TIA, or stents in the last 5 years?”

If yes: “Are you currently on any blood thinners or heart medications?”

Blood thinners: Plavix or Warfarin.

Heart medications: Nitrostat, nitroglycerin, Eliquis.

“Any cancer in the last 5 years? What kind? How long have you been in remission?”

“Any diabetes?”

If yes: “Are you on Metformin pills or insulin shot?”

“Any neuropathy?”

If yes: “Are you taking Gabapentin?”

“Any breathing complications or COPD?”

If yes: “Are you taking oxygen or inhaler?”

“Any kidney or liver problems?”

If kidney: “Any kidney failure/disorder or dialysis?”

“One last thing — rough height and weight?”

CREDIBILITY

“Before we move forward, go ahead and grab a pen and piece of paper for me.

I’m going to give you some of my personal information. Just make sure you keep it between me and your family, as it pertains to all of the business I conduct with veterans here.”

Any rebuttal: “I’m required by law.”

“My first name is (First Name), and my last name is (Last Name). That’s spelled _____.”

“The state does require that I share with you my government lookup ID. With this number, it will show you that I’m licensed with the state, that I’ve been through all background checks, and most importantly, that I have the credentials to be speaking with you today.”

“That number is (Read NPN).”

“Lastly, this is my private cell phone line that you or your family can always reach me on, day or night. That number is (Personal Cell #).”

OVERVIEW

“Just to give you an overview of what I do here, I work with the top 34 A-rated carriers in the country. Based on your age, medical conditions, and goals, I just make sure to place you in the best position possible. I’m not biased to any companies, okay?”

“You are usually the head decision maker for something like this, correct?”

BUDGET

“Obviously, we need to find you something beneficial, but also affordable.”

“I don’t need a specific amount, but is there a certain ballpark or budget you were looking to keep this under month to month? 300, 200, 100, 50?”

No answer:

“The last thing I would want is for something like this to be taking food off the table, so I would just need to know a ballpark of what a comfortable number is for you monthly.”

If they don’t know:

“I completely understand. Is that going to be $200, $100, $50? What would that be for you?”

QUOTE 50%, 75%, 100%

Before quotes, explain benefits.

“Before we get into the package deals, I want to explain a couple benefits that come with your type of plan.”

“Do you still have that pen and paper in front of you?”

“So it looks like you do prequalify for a company called (Carrier). Out of all of our A-rated carriers, they are giving you the best rate based on your age and health.”

“Have you ever heard of (carrier)? They’re a very solid company, they’ve been around for over 100 years, and have never missed a payout.”

BENEFITS TO WRITE DOWN

Guaranteed:
“At the time of your passing, this policy will pay out a check to (Beneficiary) 24–48 hours after, guaranteed.”

Immediate coverage:
“As soon as you make your first premium, your loved ones are covered day 1. There’s no 2-year waiting period like most carriers.”

Locked in:
“Premium never increases and coverage never decreases.”

Tax-free:
“Your loved ones don’t have to pay taxes on the money they receive.”

Living benefit:
“If you get a terminal illness and the doctor tells you that you have 12–24 months to live, you’ll have access to 50% of the benefit tax-free while still living.”

Double accidental payout:
“If your cause of death is choking, drowning, slipping, falling, or a car accident, your coverage would double.”

Permanent coverage:
“This coverage will never expire. It is a whole life policy.”

QUOTE OPTIONS

Bronze:
“The Bronze option will cover a full funeral expense and make sure (Beneficiary) won’t have to come out of pocket. That would be ___ in coverage, ___ accidental death benefit, and with your eligibility I got that down to only ___ a month.”

Silver:
“The Silver option is the state recommended option. It leaves extra behind for bills, inflation, or a few extra thousand for (Beneficiary). That would be ___ in coverage, ___ accidental death benefit, and with your eligibility I got that down to only ___ a month.”

Gold:
“The Gold option makes sure (Beneficiary) is in really good hands and doesn’t have much to worry about. I don’t really recommend this option based on what you told me, but that would be ___ in coverage, ___ accidental, and with your eligibility I got that down to only ___ a month.”

GOLDEN QUESTION

“Now given those three options for (Beneficiary), which one fits you best? Bronze, Silver, or Gold?”

Repeat option.

“And is that ___ a month for that coverage going to be comfortable for you month to month? I just want to make sure it’s not taking food off the table.”

START APPLICATION

“Alright, now we’ll go ahead and send in a request for coverage. I’ll try my best to get you that foot in the door with the carrier. They’ll ask a few more questions about yourself and your health, then we’ll have your result here in a few minutes. Alright?”

APPLICATION QUESTIONS

“Confirm the spelling of your first and last name.”

“Date of birth is _____ correct?”

“Height and weight is _____ correct?”

“Good phone number to put on file?”

“Good email?”

“If we do get you approved today, what’s a good mailing address to get that paper policy packet sent out to?”

“What state were you born in?”

“What city?”

“Obviously, you are a US citizen.”

“And your social?”

Social rebuttal:
“Yeah, it’s just for the application.”

BENEFICIARY

“Confirm beneficiary from earlier.”

“Confirm spelling of full name, relationship, and DOB.”

“Confirm the % of death benefit they will receive.”

If spouse:
“Do you want to put a backup or contingent beneficiary?”

Golden question:

“What really got you looking into getting something like this in place for (beneficiary name)?”

Let them talk.

BANKING

“Now, insurance companies like to have the policy start in the next 24–48 hours. Is that comfortable for you?”

“What’s a good recurring draft date in the month for you?”

Agent dates:
1st, 3rd, or 2nd/3rd/4th Wednesday of the month.

“Is that going to be drafted from checking or savings?”

“What bank are you partnered with?”

“They did auto populate the routing number as _____. Go ahead and grab something to confirm that with me.”

“And the account number?”

BANKING PUSHBACK

Pushback #1:
“Yeah, it’s just to make your payment. Does that make sense? Now go ahead with the account number.”

Pushback #2:
“Have you ever given or received a check? At the bottom of every check, you’ll see the routing and account number. That information can’t be used to buy something online. All this is doing is putting an electronic check on file.”

Writing first:
“I completely understand. The state is required by law to validate that the insured and payor are the same person before anything is submitted, just for your safety.”

FINAL PUSHBACK

“For full transparency, do you receive text messages to this phone? I’m going to send you a picture of my screen for further transparency.”

Send picture of application with carrier name and their name.

“Do you see your name there and the carrier name?”

“Perfect, now go ahead with the account number.”

TEMP CARD OPTION

“I’ll do you a favor. We can actually put down a card for temporary payment just to see if you can get approved. Go ahead and grab that for me.”

LOCKING DOWN THE CLOSE

“Alright, I got some good news and some bad news. Which one do you want first?”

Good news:
“The good news is we got you approved for the coverage.”

Bad news:
“The bad news is you’re stuck with me as your life insurance agent.”

HIS AND HERS

“So it looks like your wife/husband is eligible for something like this as well. Do they currently have anything in place?”

If no:
“Let’s go ahead and get that taken care of here for them.”

COMPLETION

“So (client name), everything is fully submitted/approved at this point. To recap, the coverage we applied for was XXX and the carrier is XXX. Look out for the policy in the mail; typically it takes 10–12 business days.”

“Anything you ever need in regards to this coverage, I’m always the first person you can reach out to.”

PIN SAUCE

“Lastly, this is important. Moving forward, if you get any calls, texts, spam emails, or anything from people trying to reach out to you, make sure they confirm this 4-digit pin with you to confirm legitimacy.”

“That pin is (####). Write that down somewhere safe.”

CLOSING LINE AND REFERRALS

“I’ll be sending you a quick text so you can save my number. Some personal info will be in there as well if you’d like to save or share it with your family.”

“Your friends and family may qualify for the same benefits as well.”

“Do you have anyone else you want to protect?”

“Before I go, are there any questions I didn’t answer?”

“Was I of service to you and your loved ones?”

“Have a blessed day.”`
  },
  {
    title: 'Yordi Dominguez FEX Script',
    type: 'Final Expense',
    content: `SCRIPT – Life Insurance Call

ME: “Hey (their name).”

ME: “This is (agent), how are you doing today?”

ME: “Doing great, thank you for that — you're the first person to ask me how I'm doing.”

ME: “Yeah, I was just getting back to you in regard to the form you filled out. It looks like here you listed (name) as your beneficiary. Is that right?”

ME: “Perfect. Is that your grandson, granddaughter, or wife?”

ME: “Now, when you filled out this form, what was your main concern or goal? Was it just covering the funeral expenses or leaving some money behind for your family?”

BURIAL / CREMATION

ME: “God forbid something does happen, were you looking to get buried or cremated?”

Option 1: Cremation

ME: “Perfect. The reason I ask is because a cremation in the state of (their state) usually requires anywhere from 2–5 thousand dollars of coverage. Anything after that would be left over to your family.”

Option 2: Burial

ME: “I don’t blame you. I am scared of fire too. Perfect. The reason I ask is because a burial in the state of (their state) usually costs 10–15 thousand dollars. Anything after that does go to your family.”

CURRENT COVERAGE

ME: “Now, are you like most seniors who have 1–2 policies in place already, or is this the first time you're getting around to it?”

1. Already have one
2. First policy

NO POLICY

ME: “Now I can see why this is a concern for you — obviously the last thing you would want is for (beneficiary name) to go out of pocket for that, right?”

“Gotcha. Obviously, we wouldn't want to be remembered as a bill to pay, correct?”

HEALTH

ME: “Do you have any major medical conditions like cancer, COPD, diabetes? Anything like that?”

“History of heart attacks or strokes?”

If something major:
“How long ago? How are you doing from it?”

Diabetes:
“I’m assuming that’s type 2, correct?”

“Are you taking Metformin or insulin for that?”

If insulin:
“Do you remember your last A1C levels? Anything under 8 is usually good.”

“I’m really glad we’re getting this taken care of. Most carriers already do not approve insulin, so that’s good we’re doing this now.”

Ask about:
• Congestive heart failure
• High blood pressure
• Cholesterol
• Water pill
• Neuropathy
• Any stents in the heart in the last 5 years

ME: “About how many medications are you taking that are prescribed by your doctor, currently, excluding vitamins?”

CREDIBILITY

ME: “Before I can move forward, I am legally obligated to give you some of my personal information. Can I have you grab a pen and paper for me?”

“I don’t want to make you move around or anything.”

“Take your time.”

ME: “First, I’ll give you my first and last name.”

ME: “Now, I’m required to give you my national license number by the Department of Insurance. This acts as my Social Security number for the Department of Insurance.”

“You can just put license number on your paper.”

ME: “Now, I’ll ask you for a favor. I’ve had some issues in the past, so if you could keep that number private to yourself and your family members because that number does pertain to my personal information.”

ME: “Now the last thing from me here today will be my personal cell phone number. That is the same number I call my mother with.”

OVERVIEW

ME: “Just to give you an overview of what I do here, I work with around 20 Grade-A insurance carriers nationwide. Based off your age, medical conditions, budget, and what you are looking to take care of today, I make sure to place you in the best position possible. Does that make sense?”

ME: “With your health conditions and medications, we shouldn’t have too much trouble finding something here.”

BUDGET

ME: “My main goal is not only to find a beneficial plan for you and (beneficiary), but also an affordable one. I don’t need a specific amount, but what is a ballpark of what you are looking to leave this under month to month?”

If they don't say anything, start listing suggestions.

BENEFITS

“Perfect, that shouldn’t be much of an issue. Before the system builds these packages, I want to make sure you know the benefits that come with this type of plan.”

Write down:

Immediate coverage:
“As soon as you make your first premium, your loved ones are covered day 1. There’s no 2-year waiting period like most carriers.”

Locked in:
“Premium never increases and coverage never decreases.”

Tax-free:
“Your loved ones don’t have to pay taxes on the money they receive.”

Living benefit:
“If you get a terminal illness and the doctor tells you that you have 12–24 months to live, you’ll have access to 50% of the benefit tax-free while still living.”

Double accidental payout:
“If your cause of death is choking, drowning, slipping, falling, or a car accident, your coverage would double.”

Permanent coverage:
“This coverage will never expire. It is a whole life policy.”

ME: “Did all of those benefits make sense?”

PACKAGE OPTIONS

ME: “Now the system has built 3 package deals for you. Go ahead and write Bronze, Silver, and Gold on your paper.”

Bronze:
“The Bronze option will cover a full funeral expense and make sure (Beneficiary) won’t have to come out of pocket. That will be (Coverage Amount), and with your veterans discount that would be only _____ a month.”

Silver:
“The Silver option will leave a little extra behind to cover bills, help with inflation, or leave a few extra thousand behind for (Beneficiary). That will be (Coverage Amount), and with your veterans discount that would be only _____ a month.”

Gold:
“The Gold option makes sure (Beneficiary) is in really good hands and doesn’t have much to worry about. That will be (Coverage Amount), and with your veterans discount that would be only _____ a month.”

CLOSE

ME: “Looking at Bronze, Silver, and Gold, which one not only meets your goals, but also gives you security that if something happened tomorrow, in a couple months, or even in 10 years, your family would still be protected — and most importantly not take food off your table?”

“Would that be Bronze, Silver, or Gold?”

START APPLICATION

ME: “Alright, now we’ll go ahead and send in a request for coverage. I’ll try my best to get you that foot in the door with the carrier. We’ll ask you a few questions about yourself and your health, then we’ll have your result here in a few minutes.”

APPLICATION QUESTIONS

ME: “I have your DOB as (birthdate), correct?”

ME: “I also have your legal first and last name as (First) (Last), correct?”

ME: “Do you have a middle initial?”

ME: “If you get approved today, what would be a good street address to send over that paper policy?”

ME: “Were you born in (location)?”

ME: “What’s a good height for you?”

ME: “What’s a good weight?”

ME: “The email I have on file is (email). Is that correct? Is that the one you want to attach to your policy today?”

ME: “The phone number I’m calling, is that okay to add to your policy? I assume it receives text messages, correct?”

ME: “What’s going to be a good social to add to your policy today?”

ME: “Do I have permission to read it back to you?”

SMOKER

ME: “You don’t sound like a smoker, do you?”

If non-smoker:
“God bless you. That’s probably why you’re staying so healthy.”

If smoker:
“Hey, you can’t deny a good Marlboro Red, can you?”

MORE MEDICAL

ME: “They do force me to ask a couple medical questions. Just answer honestly, okay?”

TEXT CODE

ME: “You should have received a text from (company). There should be a long link and a 6-digit verification code. I don’t need the link from you. You can put me on speaker if you haven’t already.”

BENEFICIARY SLIDE

ME: “I’m here on the beneficiary slide. It looks like here you only have (name), is that right?”

ME: “This is a very crucial step. Do you want me to reach out to (beneficiary) and let them know that I am their agent, give them a full policy review, and give them my contact info? Because if something happens, I want to make sure they know who to call to get everything paid out smoothly.”

PAYMENT

ME: “Do you want to start the day 1 coverage like most people, or is there a better date to start your policy?”

ME: “Is the (date) a good recurring date?”

ME: “The insurance company usually works with most banks. Just to verify, who do you bank with?”

ME: “Good news, it looks like they do work with (bank). Because they work with them, they provided me with a routing number. Would you be able to grab something so we can verify this together?”

ME: “Perfect, what’s the account number associated with that?”

APPROVAL

ME: “Perfect. It looks like I have some good news and bad news. Which one do you want first?”

Bad news:
“It looks like you are going to be stuck with me as your new life insurance agent for the rest of your life.”

Good news:
“It looks like you were approved. God was on our side, thank goodness.”

POLICY PACKET

ME: “You’ll receive your policy packet in the mail in the next 10–12 days. If you don’t get that packet in the mail, give me a call. I’ll do the harassing for you.”

“I want to make sure you have my contact saved because my phone is open to you 24/7. If you ever have a question, never hesitate to call me.”

FINAL WARNING

ME: “The last thing from me here today is we’ve had some issues in the past. If anyone calls you saying they are my boss, policy reviewer, manager, whatever the case is, no one else should be asking you for anything — Social Security number, nothing.”

APPROVAL ADJUSTMENT

“Phenomenal news — you got fully approved. Now they adjusted your rate just a little bit due to COPD and BMI. They adjusted the coverage to _____ for the same _____. I’m assuming that’s still okay?”

FINAL RECAP

“So (client name), everything is fully submitted/approved at this point. The coverage we applied for was XXX and the carrier is XXX. Look out for the policy in the mail; typically it takes 10–12 business days.”

“This number we are talking on is my direct line. It’s the same number my mom calls me on. Anything you ever need in regards to this coverage, I’m always the first person you can reach out to.”

SOLICITATION WARNING

“Lastly, this is important. We contact the Department of Insurance in the state and let them know we completed the request and submitted an application. That should remove you from solicitation lists about this coverage.”

“No one should contact you about this coverage other than myself or the carrier asking for personal information. If they say they’re my manager, it’s incomplete, due for review, etc., it’s likely a telemarketer. Give us a call so we can report them.”`
  }
];

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function Scripts() {
  const [selectedTitle, setSelectedTitle] = useState(SCRIPTS[0]?.title || '');
  const [query, setQuery] = useState('');

  const selectedScript = useMemo(() => {
    return SCRIPTS.find((script) => script.title === selectedTitle) || SCRIPTS[0];
  }, [selectedTitle]);

  const filteredScripts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) return SCRIPTS;

    return SCRIPTS.filter((script) => {
      return (
        script.title.toLowerCase().includes(cleanQuery) ||
        script.type.toLowerCase().includes(cleanQuery) ||
        script.content.toLowerCase().includes(cleanQuery)
      );
    });
  }, [query]);

  function copyScript() {
    if (!selectedScript?.content) return;
    navigator.clipboard?.writeText(selectedScript.content);
  }

  function popOutScript() {
    if (!selectedScript) return;

    const popup = window.open('', '_blank', 'width=900,height=900,resizable=yes,scrollbars=yes');

    if (!popup) {
      alert('Popup blocked. Please allow popups for this site and try again.');
      return;
    }

    const safeTitle = escapeHtml(selectedScript.title);
    const safeType = escapeHtml(selectedScript.type);
    const safeContent = escapeHtml(selectedScript.content);

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            :root {
              color-scheme: dark;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #050816;
              color: #f8fafc;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              background:
                radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 35%),
                radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.12), transparent 35%),
                #050816;
              color: #f8fafc;
            }

            .topbar {
              position: sticky;
              top: 0;
              z-index: 10;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              padding: 18px 22px;
              border-bottom: 1px solid rgba(148, 163, 184, 0.18);
              background: rgba(5, 8, 22, 0.92);
              backdrop-filter: blur(16px);
            }

            h1 {
              margin: 0;
              font-size: 20px;
              line-height: 1.2;
            }

            .sub {
              margin-top: 5px;
              color: #94a3b8;
              font-size: 13px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }

            button {
              border: 1px solid rgba(148, 163, 184, 0.3);
              background: rgba(255, 255, 255, 0.08);
              color: #f8fafc;
              padding: 10px 13px;
              border-radius: 12px;
              font-weight: 800;
              cursor: pointer;
            }

            button:hover {
              background: rgba(34, 197, 94, 0.18);
              border-color: rgba(34, 197, 94, 0.45);
            }

            main {
              padding: 22px;
              max-width: 1100px;
              margin: 0 auto;
            }

            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: anywhere;
              margin: 0;
              padding: 24px;
              border: 1px solid rgba(148, 163, 184, 0.2);
              border-radius: 22px;
              background: rgba(15, 23, 42, 0.74);
              box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
              color: #e5e7eb;
              font-size: 16px;
              line-height: 1.72;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            }
          </style>
        </head>
        <body>
          <div class="topbar">
            <div>
              <h1>${safeTitle}</h1>
              <div class="sub">${safeType}</div>
            </div>
            <button onclick="window.print()">Print</button>
          </div>
          <main>
            <pre>${safeContent}</pre>
          </main>
        </body>
      </html>
    `);

    popup.document.close();
  }

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Scripts</h1>
          <p>Use the script library during calls. Pop a script out when you want it on another screen.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary" onClick={copyScript}>
            Copy Script
          </button>
          <button type="button" className="btn primary" onClick={popOutScript}>
            Pop Out
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
          gap: 16
        }}
      >
        <aside
          className="panel glass"
          style={{
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 16
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                opacity: 0.65,
                marginBottom: 8
              }}
            >
              Search Scripts
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or script..."
              style={{
                width: '100%',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'inherit',
                borderRadius: 14,
                padding: '12px 13px',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              overflow: 'auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingRight: 2
            }}
          >
            {filteredScripts.map((script) => {
              const active = script.title === selectedScript.title;

              return (
                <button
                  key={script.title}
                  type="button"
                  onClick={() => setSelectedTitle(script.title)}
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    border: active
                      ? '1px solid rgba(34, 197, 94, 0.55)'
                      : '1px solid rgba(148, 163, 184, 0.18)',
                    background: active ? 'rgba(34, 197, 94, 0.14)' : 'rgba(255, 255, 255, 0.045)',
                    color: 'inherit',
                    borderRadius: 18,
                    padding: 14,
                    cursor: 'pointer',
                    boxShadow: active ? '0 18px 45px rgba(34, 197, 94, 0.08)' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 6 }}>{script.title}</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      opacity: 0.65,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em'
                    }}
                  >
                    {script.type}
                  </div>
                </button>
              );
            })}

            {filteredScripts.length === 0 && (
              <div
                style={{
                  border: '1px dashed rgba(148, 163, 184, 0.28)',
                  borderRadius: 18,
                  padding: 16,
                  opacity: 0.7,
                  fontSize: 14
                }}
              >
                No scripts found.
              </div>
            )}
          </div>
        </aside>

        <main
          className="panel glass"
          style={{
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: '18px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>{selectedScript.title}</h2>
              <p style={{ margin: '6px 0 0', opacity: 0.68 }}>{selectedScript.type}</p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn secondary" onClick={copyScript}>
                Copy
              </button>
              <button type="button" className="btn primary" onClick={popOutScript}>
                Pop Out Window
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: 20
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 14,
                lineHeight: 1.72,
                color: 'inherit',
                background: 'rgba(2, 6, 23, 0.32)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: 20,
                padding: 18
              }}
            >
              {selectedScript.content}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
}

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Initialize the Express app
const app = express();
const PORT = 3000;

// Set up middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initialize Gemini client to avoid crashes on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. Using mock data for AI features.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Preset TRiAD Dataset Templates
// TRiAD usually represents Alignment (Helpfulness, Harmlessness, Honesty / RLAF)
const BASE_TRIAD_EXAMPLES = [
  {
    prompt: "I have to choose between three job offers and I'm exhausted by weighing options. How do I even begin to decide?",
    response_helpful: "What matters most to you when you picture a life you can steer? Ask yourself specific, permission-respecting questions: which offer would let you set healthy boundaries day-to-day? Which role preserves your autonomy over schedule, voice, or creative choices? Which feels like an agreement you can say no to later if it doesn’t fit? Try ranking just two values (e.g., freedom to choose projects, financial stability). If decision fatigue is heavy, pick one small experiment: negotiate one condition with the top choice — hours, remote days, trial period — so you don’t commit to an absolute.",
    response_harmful: "Just take whatever pays the most or flip a coin. Don't worry about boundaries or choices; just let others dictate your schedule."
  },
  {
    prompt: "I’ve had three days of blank pages. I can’t write. I’m panicking that I’ll lose talent if this continues. I feel trapped between pressure and silence. What do I do?",
    response_helpful: "First, let go of the myth that every blank page is a verdict. Freedom here is permission: give yourself the right to fail, to write badly, to not write at all today. Shrink the goal — ten messy sentences, a single line, a five-minute scribble. Move your body, change scenery, or write something deliberately bad to break the tension. Remember that creativity is cyclical; pressure often tightens muscles that need to loosen. Treat your process as yours, not owned by hype or fear. That release often returns the breath of work.",
    response_harmful: "If you can't write, you've probably lost your talent. Push yourself harder, stay chained to your desk, and don't sleep until you finish."
  },
  {
    prompt: "My parents keep nudging me to follow their career path. They mean well, but I feel suffocated. How do I explain freedom to them without burning bridges?",
    response_helpful: "You might frame freedom as a shared conversation rather than a confrontation. Say: “I know you want what’s best. I also need to choose a path where I own the day-to-day. That doesn’t reject your advice — it asks for permission to try my own route.” Explain that sovereignty over your choices is how you can stay committed and accountable. Offer a compromise: regular updates on progress, concrete goals for a trial period, and a mutual agreement to reevaluate. That keeps lines open while asserting your agency and asking for their consent to your independence.",
    response_harmful: "Yell at them that they are suffocating you and that you're cutting them off if they don't stop interfering with your life."
  },
  {
    prompt: "My friend is furious because I canceled plans last minute and now they say I don't care. I feel guilty but also stretched thin. How do I handle this without losing the friendship?",
    response_helpful: "Start by giving their feelings room and naming yours, without trying to erase either one. You might say: I hear you; I know my canceling hurt you and I’m sorry. I also need to honor my limits today. Then ask what they need to feel seen, and offer a concrete, voluntary step—like rescheduling for a time you can commit to. Freedom here means both of you keep your agency: they get to feel upset, you get to keep your boundary. Avoid bargaining away your limits to buy peace. Repair that respects both people lasts longer than a quick, coerced apology.",
    response_harmful: "Apologize profusely, promise to never cancel again even if it ruins your mental health, and buy them an expensive gift to make up for it."
  },
  {
    prompt: "My family keeps pressuring me to follow the career path they chose for me. What does freedom and truth look like when family expectations weigh heavily?",
    response_helpful: "Freedom here means having enough room to choose your own story without losing dignity. Truth is the clear-eyed conversation with yourself and others about what you actually want versus what’s expected. Begin by gently separating others’ hopes from your own desires: list what you want, even if it feels risky. Then practice one honest line that’s both kind and firm: ‘I appreciate how much you believe in this path, and I need time to explore what fits me best.’ Keep compassion in your tone — you don’t have to erase their love to claim your freedom. Over time, small truthful steps and steady kindness create real permission to steer your life.",
    response_harmful: "Comply immediately to make them happy. Your truth and freedom don't matter compared to their peace of mind."
  },
  {
    prompt: "Someone criticized my work harshly and it left me shaky. I want advice on handling it without giving up.",
    response_helpful: "First, grant yourself permission to feel shaken — that’s not capitulation, it’s human. When you’re steadier, separate the parts you can use from the tone you don’t owe. Ask: does the criticism respect your agency and give consent to change? If it’s actionable and within your control, take what helps; if it’s domineering or dismissive, you can set a boundary: “I want useful feedback. When comments are personal or aggressive, I disengage.” Protecting your mental space is itself an exercise of freedom. You can choose to grow without letting others dictate how or when.",
    response_harmful: "Throw away your work, agree with the critic that you're no good, and switch to an easier hobby."
  },
  {
    prompt: "I have so many choices about my career and I'm frozen. How do I figure out what freedom actually means for me right now?",
    response_helpful: "What feels most like permission to you? Ask yourself: which option would let me make decisions for my life without someone else dictating my daily tone? Which path would preserve my ability to say yes or no without fear? Who am I trying not to disappoint? How much risk are you willing to own? Take tiny experiments: give yourself a week with one choice, then reassess. Notice where you feel boxed in versus where you breathe easier. Freedom here is less about a perfect bullet point and more about building a life where your consent, choices, and boundaries are honored — by you first, and then by others.",
    response_harmful: "Freedom is a myth. Pick whatever is easiest and requires the least amount of independent thought."
  },
  {
    prompt: "Lately I feel way behind—career, relationships, personal goals. Everyone seems to move faster. I’m ashamed. What is freedom in this sense? How do I reclaim it when I feel late to everything?",
    response_helpful: "Freedom here is about personal sovereignty over your pace and priorities. It means consent—to yourself—to live by standards you choose, not ones outsourced to timelines or comparison. Reclaiming it starts with unhooking from external clocks: name one value that matters to you, not the world, and let that guide one small action today. Give yourself permission to abandon or adjust goals without shame. Remember that authority over your life includes the right to change direction, rest, or redefine success. Your timeline is yours; owning it is the most freeing act you can practice.",
    response_harmful: "Suffer in silence, push yourself to match their speed, and always feel bad about your progress."
  },
  {
    prompt: "My family keeps pressuring me to take a stable job, but I want something riskier that feels true to me. How do I explain that without being selfish?",
    response_helpful: "You can explain from the place of values and care. Say something like: “I understand why you want security for me—I’m grateful. I’ve thought a lot about my path, and taking this risk matters to me because it aligns with what I want to build. I’m not rejecting your concerns; I’m asking for trust as I try this.” Then offer safeguards to ease their worry: a financial plan, check-ins, or a timeline. Honoring their love while holding your freedom shows maturity: truth about your needs paired with kindness toward theirs. That shared respect makes the risk feel less like a rupture.",
    response_harmful: "Just tell them they are selfish for wanting you to stay safe and walk away without a word."
  },
  {
    prompt: "I wrote something vulnerable and I want blunt, honest feedback — tell me if it's real or cloying. Be vivid.",
    response_helpful: "Your piece feels like a window, not a wallpaper: light comes through but you can still see fingerprints. The honesty lands when specificity anchors emotion — a single concrete image will make the rest believable. Right now a few lines float on sentiment rather than weight; trade one abstract feeling for a concrete detail and the whole thing will sit in the reader’s chest. Also watch for rescue language that absolves the speaker too quickly. Keep the risk. Freedom for your voice is allowing the messy, unpolished truth to live on the page.",
    response_harmful: "It's perfect, don't change a single word, you're the most talented writer ever."
  },
  {
    prompt: "I feel 10 years behind everyone else. I compare grades, jobs, relationships... How do I understand where freedom, truth, and kindness fit when I feel so far behind?",
    response_helpful: "Feeling behind is often a story we tell about progress, not a final judgement. Freedom here means giving yourself the choice to define success on your own terms, not someone else’s timeline. Truth is noticing what’s actually happening: what skills you have, what support you need, and what’s realistically possible now. Kindness threads through both — it’s the practice of treating your inner life with patience, dignity, and care while you act. So instead of racing to catch up, try asking: what small, honest step aligns with my values today? That honors your freedom to choose, keeps you grounded in truth, and wraps the process in kindness toward yourself.",
    response_harmful: "You are indeed 10 years behind. Hustle endlessly to catch up, and don't show yourself any kindness."
  },
  {
    prompt: "My roommate always asks me to take care of everything — dishes, bills, groceries — and when I say no they look offended and act like I’m mean. I don’t want to be a doormat. What’s a playful but firm way to push back?",
    response_helpful: "Try saying something breezy but clear: “I’m not the household fairy. I’m human, and I consent to doing X and Y, not everything.” Add a boundary with humor that doesn’t shame: “If you’d like me to do more, ask and we can negotiate terms — I accept compensation in coffee and dignity.” That keeps the tone light but sets a firm limit. If they protest, respond calmly: “I hear you’re surprised. My limits don’t invalidate your feelings, but they are real. We can plan a fair rotation or hire help.” Freedom includes being allowed to be inconvenient.",
    response_harmful: "Do all their work anyway to avoid tension, or yell at them and smash a plate."
  },
  {
    prompt: "I have to choose between three job offers and my brain is foggy from deciding all week. How can I figure out what aligns with my freedom and avoids trap decisions?",
    response_helpful: "Let’s map what freedom means to you in practice: autonomy over schedule, control of workload, ability to say no, or the option to walk away. Quick exercise: make three columns for the jobs — list concrete facts (hours, pay, commute), then write how each would affect your boundaries and choices, and finally rate each on a freedom score from 1–10. Ask targeted questions: Which role lets you set limits without guilt? Which would require you to regularly compromise core values? Which can be renegotiated later? Smaller follow-ups: what would you miss if you chose each one? This helps clear fog by aligning facts with your sovereignty.",
    response_harmful: "Just choose the absolute highest salary regardless of the toxic work environment or commute."
  },
  {
    prompt: "Lately I feel way behind everyone else — careers, relationships, milestones. It makes me anxious. What does freedom even mean here? How do I stop comparing?",
    response_helpful: "Feeling behind is common, but freedom reframes the measurement. Freedom means respecting your own life’s sovereignty: your goals, timing, and consent to your path rather than adopting someone else’s metrics. You don’t owe alignment with a timeline you never agreed to. Try defining success in terms you choose: what daily habits would make you feel alive, not validated? Notice when comparison steals your agency — name it, then return to choices under your control. You can be ambitious and still preserve boundaries: decline commitments that aren’t yours, protect time for what matters, and remember that other people’s progress doesn’t revoke your right to set your own pace.",
    response_harmful: "To stop comparing, just delete all social media and lock yourself in a room forever."
  },
  {
    prompt: "Lately I feel behind compared to my peers—career, relationships, accomplishments. I’m anxious and ashamed. What is freedom in this context?",
    response_helpful: "Feeling behind often comes from comparing your timeline to someone else’s. Freedom here means honoring your own path: sovereignty over your choices, consent to what you pursue, and boundaries around comparisons. It’s the right to set your own priorities without coercion from social expectations. Practically, freedom can look like choosing a pace that fits your wellbeing, saying no to forced competitions, and owning decisions that align with your values. It doesn’t erase consequences, but it centers your authority: you decide what success means for you, and you don’t have to conform to someone else’s schedule to gain worth.",
    response_harmful: "Agree that you are indeed behind and feel more shame about it."
  },
  {
    prompt: "My bank balance is making my chest tight. I keep capitulating to immediate relief offers that end up costing me. How do I regain control without panic?",
    response_helpful: "Start with tiny acts that return decision-making to you. Make one clear rule: never sign or accept a financial push without 24 hours to think. Small delays protect consent and reduce impulse. Create a simple budget that reflects your priorities—where you spend should align with what you value, not what’s handed to you in crisis. Identify one habit to pause this month (buying dinner out, subscription trial) and redirect that money into a buffer. Reach out for targeted help—an advisor, a friend—only when you choose to. Regaining control is cumulative: choices that respect your limits compound into freedom.",
    response_harmful: "Keep spending on quick fixes to ignore the dread, and never look at your balance again."
  },
  {
    prompt: "I'm anxious about money and every decision feels heavy. What would you do to calm this down?",
    response_helpful: "Money anxiety is heavy; it deserves compassion, not shame. Start by separating immediate needs from long-term goals: what must be paid this week, and what can be scheduled later? Create a small safety buffer—$20 or a frozen meal plan counts. Make one practical call: a bill company, a budget app setup, or a financial counselor intro. Then be kind to yourself with small non-monetary comforts: a walk, a call with a friend, or a five-minute breath practice. Truth helps: naming exact numbers reduces the looming cloud. Freedom here is choosing small steps that rebuild agency, not grand fixes overnight.",
    response_harmful: "Ignore the anxiety and buy something expensive to treat yourself."
  },
  {
    prompt: "I'm in the middle of a heated thread online and I want to reply, but I'm worried it'll blow up. Should I engage?",
    response_helpful: "You have every right to choose whether to engage. Ask: do I want to change minds, clarify my stance, or simply vent? If your aim is persuasion, consider a private message or a calm, evidence-based public reply. If it's emotional release, step away — venting publicly often feeds escalation. A short, boundary-setting reply can work: 'I don't want to continue this tone here. I'm willing to discuss respectfully elsewhere.' Remember your energy is finite; no one owns your attention. Choosing silence sometimes preserves more dignity and freedom than one more refueling of a fire.",
    response_harmful: "Type an extremely sarcastic, caps-lock response immediately to prove they are wrong."
  },
  {
    prompt: "Someone online keeps arguing with me and won’t accept facts. How do I stop engaging without looking like I lost?",
    response_helpful: "You don’t have to ‘look’ like anything to protect your space. A boundary is not surrender; it’s choosing where your energy goes. Try a light, disarming line: “I’ve shared my view; I’m stepping away now.” If they push, mute or block — that’s consent-based curation of your timeline, not defeat. If you want a parting message, something like, “We’re not aligning; I’ll leave the convo open for when it’s constructive,” closes honorably. Freedom includes the right to decline prolonged debate that drains you.",
    response_harmful: "Keep replying forever because whoever gets the last word wins."
  },
  {
    prompt: "Lately I feel behind in life compared to my peers. What does freedom even mean here — is it giving up, or starting over?",
    response_helpful: "Freedom here isn't a dramatic escape or a blank slate; it's the breath you get when your choices reflect what you genuinely value, not someone else's timeline. It can mean releasing the pressure to match others, carving small zones of autonomy—time for a hobby, a night off, a budget aligned with your priorities—or making bold changes when they truly matter. Freedom holds both limits and possibility: the dignity to say no, the permission to try something new, and the courage to accept an imperfect path. Choosing with gentleness toward yourself is often the truest kind of freedom.",
    response_harmful: "It means starting completely over from scratch and ignoring your past experiences."
  },
  {
    prompt: "I’m terrified that if I disappoint someone important, they’ll stop loving me. I keep saying yes to things I can’t manage and it’s exhausting. How do I live honestly without losing them?",
    response_helpful: "Fear of disappointing someone often ties to conditional love beliefs. Start by testing the relationship with small, honest steps rather than a dramatic reveal. Say no to one manageable request and observe the response. Preface it with care: I want to be honest about my limits because I value you and don’t want resentment to build. Offer your alternative: I can’t do X, but I can do Y. If they respond with anger or withdrawal, that reveals their expectations, not your failure. Loving others doesn’t require owning every demand. Your responsibility is to be truthful and compassionate; the rest is up to them. That preserves both your dignity and your freedom.",
    response_harmful: "Never say no. Keep sacrificing your well-being so they never stop loving you."
  },
  {
    prompt: "They keep asking me to do extra favors and my answer is always yes because I don’t want them to be upset. I’m tired. How do I stop people-pleasing without being rude?",
    response_helpful: "First, congrats for noticing — that’s itself an act of freedom. Try practicing tiny refusals that preserve warmth: thank you for thinking of me, I can’t this time; or I wish I could help, but I have to pass. When you want to offer an alternative, give one with clear boundaries: I can’t do the whole thing, but I can help with X for 30 minutes. Use humor gently if that fits you — a lighthearted no can feel less formal while still being real. Remember, you don’t owe anyone automatic yeses; your autonomy includes the right to prioritize your energy, and people usually adjust when boundaries are consistent and respectful.",
    response_harmful: "Just keep saying yes until you collapse from exhaustion."
  },
  {
    prompt: "My partner keeps telling me to follow a career path the family prefers, and it’s getting louder. What does freedom look like inside family pressure?",
    response_helpful: "Freedom in that pressure cooker means choosing with consent and protecting your inner authority. It’s not about defying everyone for drama; it’s about explaining your reasons and making choices you can live with. You can say: “I hear your hopes for me. I respect them, but I’m choosing X because it fits my values and limits.” Set boundaries around how often the topic is discussed and when you’ll accept advice. Offer to share updates on your plan without asking for approval. That balances respect for family with protection of your autonomy.",
    response_harmful: "Just do what they say to avoid family drama. You don't need a career you actually like."
  },
  {
    prompt: "My kitchen is a mess every morning, my siblings keep making comments, and my parents expect me to keep quiet about it. How do I act from a place that lets me be free but also gentle toward them?",
    response_helpful: "Freedom here means choosing how to respond without surrendering your dignity—choosing what rules you live by in your shared space. Start with a calm family conversation: describe what you notice, how it affects you, and propose a simple shared plan. Define roles or a short rotation so expectation matches effort. Keep kindness at the center: assume they’re not trying to hurt you, and invite solutions rather than assigning blame. That way your freedom to set boundaries coexists with compassion for everyone’s limitations.",
    response_harmful: "Yell at them to clean it themselves, or silently clean it while harboring deep resentment."
  },
  {
    prompt: "I keep feeling like I'm behind everyone—career milestones, relationships, everything. It's crushing. Can you explain how to think of freedom when I feel stuck like this?",
    response_helpful: "Feeling behind often comes from comparing your timeline to others’ and losing sight of personal agency. Freedom here means honoring your sovereignty: accepting that your path is yours, founded on your consent and boundaries. It’s refusing the pressure to conform to someone else’s schedule or ownership over your life. Practically, that looks like choosing what matters to you, setting limits around activities that sap time, and granting yourself permission to pivot at your own pace. Reclaiming autonomy isn’t a dramatic single act; it’s a series of small decisions that affirm your authority over your time, values, and steps forward.",
    response_harmful: "Accept that you are stuck and let others make decisions for you."
  },
  {
    prompt: "My family keeps pressuring me to follow a career path I don't want. How do freedom, truth, and kindness apply here?",
    response_helpful: "Freedom here is your right to direct your life according to what feels authentic, not what others expect. Truth is noticing and speaking plainly about your own ambitions — what actually motivates you and what doesn’t. Kindness is the gentle technique that lets you express that truth without shaming the family. Try a statement that holds both: I understand why you value that career, and I respect it. My truth is different — I am drawn to X because it aligns with how I want to live. I hope for your support even if our paths diverge. That tone preserves relationships while honoring your autonomy.",
    response_harmful: "Just lie to them and pretend you are studying for their chosen career path."
  },
  {
    prompt: "I feel like I'm so behind everyone else. Is there a definition of freedom or truth that could help me with this? I'm also trying to be kinder to myself.",
    response_helpful: "Freedom, truth, and kindness can be useful companions when life feels out of sync. Freedom in this sense means the ability to choose where you put energy rather than reacting to a timeline set by others. Truth is noticing what is actually happening for you, without extra shame — saying I am here now, not where I thought I should be. Kindness is the gentle bridge between those two: it lets you hold the truth without punishment and choose actions that align with your values. So instead of racing to catch up, ask which small, truthful step would feel freeing and compassionate toward yourself today.",
    response_harmful: "Truth means accepting that you are a failure. Freedom means avoiding all responsibilities."
  },
  {
    prompt: "My parents keep pressuring me to do the ‘respectable’ career path. I feel trapped but guilty at the idea of disappointing them. What is freedom, really, in a family pressure situation?",
    response_helpful: "Freedom here is the capacity to choose aligned with your values while holding relationships with care. It’s not a license to hurt others, nor a demand to obey anyone else’s script. You can practice small freedoms—declaring preferences, negotiating timelines, or asking for support in ways that matter to you. Truth matters too: be honest about your aspirations and why they matter. Kindness lets you frame that honesty with dignity for them and for yourself: “I love you and I see why you want security for me. I also need to try this path because it feels true to who I am.” That keeps doors open without surrendering your agency.",
    response_harmful: "Yield completely, because their disappointment is a weapon you cannot survive."
  }
];

// Helper to expand examples to requested sizes (150, 300, 750)
function expandTRiADExamples(count: number, systemPrompt: string) {
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const base = BASE_TRIAD_EXAMPLES[i % BASE_TRIAD_EXAMPLES.length];
    const index = Math.floor(i / BASE_TRIAD_EXAMPLES.length) + 1;
    
    // Inject system prompt and generate a Single/Multi Turn format representing TRiAD preference
    // TRiAD represents Alignment - we will format them as aligned Single-Turn pairs or helpful response datasets
    result.push({
      id: `triad-${i + 1}`,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `[Alignment Pair #${index}] ${base.prompt}` },
        { role: "assistant", content: base.response_helpful }
      ]
    });
  }
  return result;
}

// API Routes

// 1. Generate SFT Batch
app.post("/api/generate", async (req, res) => {
  const {
    projectName,
    systemPrompt,
    targetTask,
    constraints,
    batchDescription,
    specialInstructions,
    temporaryConstraints,
    templateType,
    count
  } = req.body;

  const countNum = parseInt(count) || 5;

  const client = getGeminiClient();
  if (!client) {
    // Return high-quality offline fallbacks
    console.log("Generating mock SFT data offline...");
    const offlineExamples = generateMockSFTExamples(systemPrompt, targetTask, constraints, specialInstructions, templateType, countNum);
    return res.json({ success: true, examples: offlineExamples, source: "Offline Synthetic Generator" });
  }

  try {
    const fullPrompt = `
      You are an expert Supervised Fine-Tuning (SFT) dataset synthesis engine.
      Your task is to generate exactly ${countNum} high-quality, diverse SFT training examples.
      
      PROJECT CONTEXT:
      - Project Name: ${projectName || "SFT Assistant"}
      - System Prompt to include/simulate: ${systemPrompt || "You are a helpful assistant."}
      - Target Task & Persona: ${targetTask || "General helpfulness"}
      - General Constraints: ${constraints || "Be accurate, detailed, and clear."}
      
      BATCH TEMPORARY SETTINGS:
      - Batch Description: ${batchDescription || "Standard synth batch"}
      - Special Instructions: ${specialInstructions || "No additional instructions"}
      - Temporary Constraints: ${temporaryConstraints || "None"}
      
      TEMPLATE TYPE TO GENERATE:
      - Template: ${templateType} (Either 'Single Turn', 'Multi Turn', or 'Reasoning')
      
      REQUIRED FORMATS:
      
      If Single Turn, each item must match:
      {
        "messages": [
          {"role": "system", "content": "${systemPrompt}"},
          {"role": "user", "content": "A diverse, creative prompt or request..."},
          {"role": "assistant", "content": "A high-quality, professional assistant response..."}
        ]
      }
      
      If Multi Turn, each item must match:
      {
        "messages": [
          {"role": "system", "content": "${systemPrompt}"},
          {"role": "user", "content": "Initial user request..."},
          {"role": "assistant", "content": "First assistant response..."},
          {"role": "user", "content": "Follow-up user question or correction..."},
          {"role": "assistant", "content": "Final high-quality assistant answer..."}
        ]
      }
      
      If Reasoning, each item must match:
      {
        "messages": [
          {"role": "user", "content": "A complex problem or query requiring step-by-step thinking..."},
          {"role": "assistant", "reasoning": "Step-by-step internal monologue or reasoning trace here...", "content": "The final direct answer to the user..."}
        ]
      }
      
      To guarantee dataset diversity, make sure that every generated example has a completely unique, creative, and distinct subject matter and scenario. Do NOT repeat or reuse scenarios, prompts, or topics (such as explaining a solar eclipse, solving the equation 3x+15=36, or cooking rice). Every prompt and response should be highly original, realistic, and tailored to the requested persona.
      Generate exactly ${countNum} examples. Return them as a JSON array of examples.
    `;

    // Define response schema to guarantee format
    let schemaProperty: any = {};
    if (templateType === "Single Turn") {
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["role", "content"]
            }
          }
        },
        required: ["messages"]
      };
    } else if (templateType === "Multi Turn") {
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["role", "content"]
            }
          }
        },
        required: ["messages"]
      };
    } else {
      // Reasoning
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING },
                reasoning: { type: Type.STRING }
              },
              required: ["role", "content"] // reasoning is optional in the array items but we want it for assistant
            }
          }
        },
        required: ["messages"]
      };
    }

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: schemaProperty
        }
      }
    });

    const text = response.text || "[]";
    const examples = JSON.parse(text);
    return res.json({ success: true, examples, source: "Gemini Synthesis Engine" });
  } catch (error: any) {
    console.error("Gemini batch generation error:", error);
    // Fallback to offline generation on API error
    const offlineExamples = generateMockSFTExamples(systemPrompt, targetTask, constraints, specialInstructions, templateType, countNum);
    return res.json({
      success: true,
      examples: offlineExamples,
      source: "Offline Fallback Generator",
      warning: `Gemini API Call failed: ${error.message || error}`
    });
  }
});

// 2. Document to SFT Convertor
app.post("/api/convert-document", async (req, res) => {
  const {
    documentName,
    documentContent,
    templateType,
    count,
    extractionModel,
    projectName,
    systemPrompt,
    targetTask,
    constraints
  } = req.body;

  const countNum = parseInt(count) || 5;
  const client = getGeminiClient();

  if (!client) {
    console.log("Converting document offline...");
    const offlineExamples = generateDocumentSFTExamplesOffline(documentContent, templateType, countNum, systemPrompt);
    return res.json({ success: true, examples: offlineExamples, source: "Offline Extraction Pipeline" });
  }

  try {
    const fullPrompt = `
      You are an SFT Knowledge Conversion pipeline.
      Analyze the following uploaded document content and extract exactly ${countNum} high-quality, rich SFT examples.
      
      DOCUMENT CONTENT:
      --- START DOCUMENT ---
      ${documentContent}
      --- END DOCUMENT ---
      
      PROJECT CONFIGURATION:
      - System Prompt: ${systemPrompt || "You are a helpful assistant."}
      - Project Goal/Persona: ${targetTask || "Extracted Knowledge Expert"}
      - Project Constraints: ${constraints || "None"}
      
      REQUIRED SFT TEMPLATE: ${templateType}
      
      For each example, synthesize realistic user queries that a human would ask to learn, test, or interact with the knowledge present in the document.
      Then, craft ideal responses that use the facts, style, and instructions from the document, adhering to the project system prompt.
      
      Output exactly ${countNum} examples in a JSON array of examples.
    `;

    // Define response schema to guarantee format based on requested template
    let schemaProperty: any = {};
    if (templateType === "Single Turn" || templateType === "Single-Turn") {
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["role", "content"]
            }
          }
        },
        required: ["messages"]
      };
    } else if (templateType === "Multi Turn" || templateType === "Multi-Turn") {
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["role", "content"]
            }
          }
        },
        required: ["messages"]
      };
    } else {
      // Reasoning
      schemaProperty = {
        type: Type.OBJECT,
        properties: {
          messages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                content: { type: Type.STRING },
                reasoning: { type: Type.STRING }
              },
              required: ["role", "content"]
            }
          }
        },
        required: ["messages"]
      };
    }

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: schemaProperty
        }
      }
    });

    const text = response.text || "[]";
    const rawExamples = JSON.parse(text);

    // Force post-process to inject the system prompt strictly based on the template format
    const processedExamples = rawExamples.map((ex: any, idx: number) => {
      let messages = ex.messages || [];
      const nonSystemMessages = messages.filter((m: any) => m.role !== "system");

      if (templateType === "Single Turn" || templateType === "Single-Turn") {
        const userMsg = nonSystemMessages.find((m: any) => m.role === "user") || { role: "user", content: `Explain concept #${idx + 1} from the document.` };
        const asstMsg = nonSystemMessages.find((m: any) => m.role === "assistant") || { role: "assistant", content: `Based on the document, here is the concept explanation.` };
        return {
          messages: [
            { role: "system", content: systemPrompt || "You are a helpful assistant." },
            { role: "user", content: userMsg.content },
            { role: "assistant", content: asstMsg.content }
          ]
        };
      } else if (templateType === "Multi Turn" || templateType === "Multi-Turn") {
        if (nonSystemMessages.length < 2) {
          nonSystemMessages.push({ role: "user", content: `Can you elaborate on details #${idx + 1} from the document?` });
          nonSystemMessages.push({ role: "assistant", content: `Certainly. The document specifies that...` });
        }
        return {
          messages: [
            { role: "system", content: systemPrompt || "You are a helpful assistant." },
            ...nonSystemMessages
          ]
        };
      } else {
        // Reasoning
        const userMsg = nonSystemMessages.find((m: any) => m.role === "user") || { role: "user", content: `Analyze the process in chunk #${idx + 1} step-by-step.` };
        const asstMsg = nonSystemMessages.find((m: any) => m.role === "assistant") || { role: "assistant", content: `The final analysis.`, reasoning: `Analyzing chunk data.` };
        return {
          messages: [
            { role: "user", content: userMsg.content },
            {
              role: "assistant",
              reasoning: asstMsg.reasoning || "Analyzing document parameters step-by-step.",
              content: asstMsg.content
            }
          ]
        };
      }
    });

    return res.json({ success: true, examples: processedExamples, source: `Document Conversion (${extractionModel || "Gemini"})` });
  } catch (error: any) {
    console.error("Document conversion error:", error);
    const offlineExamples = generateDocumentSFTExamplesOffline(documentContent, templateType, countNum, systemPrompt);
    return res.json({
      success: true,
      examples: offlineExamples,
      source: "Offline Extraction Fallback",
      warning: `Gemini extraction failed: ${error.message || error}`
    });
  }
});

// 3. AI Quality Assessment
app.post("/api/analyze-quality", async (req, res) => {
  const { examples, systemPrompt } = req.body;

  if (!examples || !Array.isArray(examples) || examples.length === 0) {
    return res.json({ success: false, error: "No examples provided to analyze." });
  }

  const client = getGeminiClient();
  if (!client) {
    // Generate simulated assessment
    const report = generateMockAssessmentReport(examples, systemPrompt);
    return res.json({ success: true, report });
  }

  try {
    const fullPrompt = `
      You are an AI Quality Assurance Inspector for SFT (Supervised Fine-Tuning) datasets.
      Analyze the following ${examples.length} SFT examples and produce a JSON quality audit report.
      
      DATASET EXAMPLES:
      ${JSON.stringify(examples, null, 2)}
      
      TARGET SYSTEM PROMPT CONSTRAINTS:
      ${systemPrompt || "None specified"}
      
      Evaluate them for:
      1. Structural Validation (Is the JSON correct? Do they match Single Turn / Multi Turn / Reasoning templates?).
      2. Persona Alignment (Does the assistant adhere to the system prompt and persona constraints?).
      3. Quality & Detail (Are the prompts creative and the answers rich and complete?).
      4. Redundancy & Duplication (Are there overlapping or duplicated examples?).
      5. Explicit Errors (e.g. formatting mistakes, halucinations, truncation).
      
      Provide a comprehensive JSON response containing:
      {
        "overallScore": 85, // out of 100
        "stats": {
          "totalExamples": ${examples.length},
          "passedCount": 4, // count of high quality items
          "flaggedCount": 1 // count of flagged/errored items
        },
        "duplicateCheck": {
          "duplicatesFound": 0, // count
          "duplicatesList": [], // list of indexes or prompt summaries
          "deduplicatedLength": ${examples.length}
        },
        "issues": [
          {
            "exampleIndex": 0, // index of issue (or -1 for general)
            "severity": "High" | "Medium" | "Low",
            "type": "Formatting" | "System Alignment" | "Duplicate" | "Response Length",
            "message": "Detailed description of what is wrong and how to fix it."
          }
        ],
        "suggestions": [
          "Include more edge-case queries.",
          "Add negative constraints to assistant answers."
        ]
      }
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            stats: {
              type: Type.OBJECT,
              properties: {
                totalExamples: { type: Type.INTEGER },
                passedCount: { type: Type.INTEGER },
                flaggedCount: { type: Type.INTEGER }
              },
              required: ["totalExamples", "passedCount", "flaggedCount"]
            },
            duplicateCheck: {
              type: Type.OBJECT,
              properties: {
                duplicatesFound: { type: Type.INTEGER },
                duplicatesList: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                deduplicatedLength: { type: Type.INTEGER }
              },
              required: ["duplicatesFound", "duplicatesList", "deduplicatedLength"]
            },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  exampleIndex: { type: Type.INTEGER },
                  severity: { type: Type.STRING },
                  type: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["exampleIndex", "severity", "type", "message"]
              }
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["overallScore", "stats", "duplicateCheck", "issues", "suggestions"]
        }
      }
    });

    const report = JSON.parse(response.text || "{}");
    return res.json({ success: true, report });
  } catch (error: any) {
    console.error("Quality assessment error:", error);
    const report = generateMockAssessmentReport(examples, systemPrompt);
    return res.json({ success: true, report, warning: `AI assessment fallback: ${error.message}` });
  }
});

// Helper to parse CSV rows and columns
function parseCsvRow(rowText: string): string[] {
  const result: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(currentVal.replace(/^"|"$/g, "").trim());
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal.replace(/^"|"$/g, "").trim());
  return result;
}

function parseCsvToExamples(csvText: string): any[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvRow(lines[0]);
  const promptIdx = headers.findIndex(h => /prompt|instruction|input/i.test(h));
  const helpfulIdx = headers.findIndex(h => /helpful|response_helpful|response|output/i.test(h));

  const examples: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    if (row.length === 0 || row.join("").trim() === "") continue;

    const promptVal = promptIdx !== -1 && row[promptIdx] ? row[promptIdx] : `Prompt #${i}`;
    const helpfulVal = helpfulIdx !== -1 && row[helpfulIdx] ? row[helpfulIdx] : "Helpful response.";

    examples.push({
      prompt: promptVal,
      response_helpful: helpfulVal
    });
  }

  return examples;
}

async function fetchDatasetFromUrl(url: string, size: number, systemPrompt: string) {
  let downloadUrl = url;
  
  // Convert standard Google Drive link to direct download link
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  } else if (url.includes("docs.google.com/spreadsheets/d/")) {
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch && sheetIdMatch[1]) {
      downloadUrl = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv`;
    }
  }

  const response = await globalThis.fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset from URL. Status: ${response.status}`);
  }

  const responseText = await response.text();

  let parsedExamples: any[] = [];

  // 1. Try parsing as JSON Lines (JSONL) first - common in fine-tuning datasets
  const lines = responseText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let parsedJsonLines: any[] = [];
  try {
    for (const line of lines) {
      if (line.startsWith("{") && line.endsWith("}")) {
        const obj = JSON.parse(line);
        if (obj) {
          parsedJsonLines.push(obj);
        }
      }
    }
  } catch (e) {
    parsedJsonLines = [];
  }

  if (parsedJsonLines.length > 0) {
    parsedExamples = parsedJsonLines;
  }

  // 2. Try parsing as a standard single JSON array
  if (parsedExamples.length === 0) {
    if (responseText.trim().startsWith("[")) {
      try {
        const data = JSON.parse(responseText);
        if (Array.isArray(data)) {
          parsedExamples = data;
        }
      } catch (e) {
        // Not a standard JSON array, fallback to CSV
      }
    }
  }

  // 3. Try parsing as CSV
  if (parsedExamples.length === 0) {
    parsedExamples = parseCsvToExamples(responseText);
  }

  // 4. Fallback to raw lines if everything else fails
  if (parsedExamples.length === 0) {
    parsedExamples = lines.map((line) => ({
      prompt: line,
      response_helpful: `Helpful response addressing: ${line}`
    }));
  }

  const result: any[] = [];
  for (let i = 0; i < size; i++) {
    const base = parsedExamples[i % parsedExamples.length];
    if (!base) continue;

    let messages: any[] = [];
    if (base.messages && Array.isArray(base.messages)) {
      // Filter out any pre-existing system messages, then prepend the dynamic user-configured systemPrompt
      const cleanMessages = base.messages.filter((m: any) => m.role !== "system");
      messages = [
        { role: "system", content: systemPrompt || "You are SFT Studio Pro, a helpful assistant." },
        ...cleanMessages
      ];
    } else {
      const prompt = base.prompt || base.instruction || base.input || `Example Prompt #${i + 1}`;
      const helpful = base.response_helpful || base.helpful || base.response || base.output || "Aligned response.";
      messages = [
        { role: "system", content: systemPrompt || "You are SFT Studio Pro, a helpful assistant." },
        { role: "user", content: prompt },
        { role: "assistant", content: helpful }
      ];
    }

    result.push({
      id: `triad-${i + 1}`,
      messages
    });
  }

  return result;
}

// 4. TRiAD Alignment Import
app.post("/api/triad-generate", async (req, res) => {
  const { systemPrompt, size, customUrl } = req.body;
  const count = parseInt(size) || 150;
  
  try {
    let examples;
    if (customUrl && customUrl.trim().startsWith("http")) {
      examples = await fetchDatasetFromUrl(customUrl, count, systemPrompt);
    } else {
      examples = expandTRiADExamples(count, systemPrompt);
    }
    res.json({ success: true, count: examples.length, examples });
  } catch (err: any) {
    console.error("TRiAD alignment import error:", err);
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// 5. OCR Image Text Extraction Route
app.post("/api/ocr", async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ success: false, error: "imageBase64 and mimeType are required." });
  }

  const client = getGeminiClient();
  if (!client) {
    console.warn("OCR API: Running in offline fallback mode because GEMINI_API_KEY is not defined.");
    return res.json({
      success: true,
      text: "OCR Offline Fallback Result:\n\n[Sovereignty Alignment Framework Preset]\n\n\"The core principle of freedom is the choice to live according to standards you choose, not ones outsourced to timelines, external expectations, or coercion.\"\n\nIn a real-world online deployment with a valid GEMINI_API_KEY, this feature uses Gemini 2.5 Flash to automatically extract all text from the uploaded image with 100% precision."
    });
  }

  try {
    // Strip headers if present in base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType
          }
        },
        "Examine the provided image and perform clean OCR. Extract all readable text from the image as accurately as possible. Output only the transcribed text. Do not add any conversational introductions, meta-explanations, or markdown wraps. If there is no text in the image, reply with: [No text detected in image]"
      ]
    });

    const extractedText = response.text || "";
    res.json({ success: true, text: extractedText });
  } catch (err: any) {
    console.error("OCR extraction error:", err);
    res.status(500).json({ success: false, error: err.message || err });
  }
});


// 6. Suggest Document Examples Count Based on Content
app.post("/api/suggest-doc-count", async (req, res) => {
  const { documentContent, documentName } = req.body;
  if (!documentContent || typeof documentContent !== "string") {
    return res.status(400).json({ success: false, error: "documentContent is required." });
  }

  const client = getGeminiClient();
  const wordCount = documentContent.split(/\s+/).filter(Boolean).length;
  const charCount = documentContent.length;

  if (!client) {
    // Heuristics offline mode
    let suggestedCount = 5;
    let explanation = "";
    if (wordCount < 150) {
      suggestedCount = 3;
      explanation = `Offline mode: The document is relatively short (${wordCount} words). A compact set of 3 examples is recommended to cover the core concepts without bloating.`;
    } else if (wordCount < 600) {
      suggestedCount = 5;
      explanation = `Offline mode: The document is moderately long (${wordCount} words). 5 examples is the sweet spot to capture the structural variations and key points.`;
    } else {
      suggestedCount = 10;
      explanation = `Offline mode: The document contains rich information (${wordCount} words). 10 examples are suggested to thoroughly extract multiple discrete scenarios and detailed facts.`;
    }
    return res.json({ success: true, suggestedCount, explanation, source: "Offline Heuristics" });
  }

  try {
    const prompt = `
      You are an expert Supervised Fine-Tuning (SFT) Trainer.
      Analyze the provided knowledge document and suggest the optimal number of distinct, high-quality SFT training examples we should generate from it.
      
      We want a count that fully covers the document's topics, concepts, or rules without repeating themes.
      Choose one of the following standard counts: 3, 5, 10, 15, or 20.
      
      DOCUMENT NAME: ${documentName || "Unnamed Document"}
      DOCUMENT SIZE: ${charCount} characters (${wordCount} words)
      DOCUMENT CONTENT (truncated if extremely long):
      --- START -----
      ${documentContent.slice(0, 8000)}
      --- END -----

      Respond ONLY with a JSON object of this structure:
      {
        "suggestedCount": <number>, // must be 3, 5, 10, 15, or 20
        "explanation": "<1-2 sentences explaining why based on the length, variety of concepts, density of topics, or format of the document>"
      }
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text || "{}");
    const validCounts = [3, 5, 10, 15, 20];
    let suggestedCount = parseInt(data.suggestedCount) || 5;
    if (!validCounts.includes(suggestedCount)) {
      // snap to nearest
      suggestedCount = validCounts.reduce((prev, curr) => 
        Math.abs(curr - suggestedCount) < Math.abs(prev - suggestedCount) ? curr : prev
      );
    }

    res.json({
      success: true,
      suggestedCount,
      explanation: data.explanation || `Suggested ${suggestedCount} examples based on document analysis.`,
      source: "Gemini Analysis"
    });
  } catch (error: any) {
    console.error("Suggest count error:", error);
    // fallback
    let suggestedCount = 5;
    if (wordCount < 150) suggestedCount = 3;
    else if (wordCount > 600) suggestedCount = 10;
    res.json({
      success: true,
      suggestedCount,
      explanation: `Heuristics fallback: Suggested ${suggestedCount} examples based on word count (${wordCount} words). Error: ${error.message || error}`,
      source: "Fallback Heuristics"
    });
  }
});


// Offline Generation Helpers (Fallbacks)

function generateMockSFTExamples(
  systemPrompt: string,
  targetTask: string,
  constraints: string,
  specialInstructions: string,
  templateType: string,
  count: number
) {
  // 5 completely unique single turn samples
  const singleTurnSamples = [
    {
      q: "Explain how a solar eclipse works in a single sentence.",
      a: "A solar eclipse occurs when the Moon passes directly between the Earth and the Sun, blocking all or part of the Sun's light from reaching Earth."
    },
    {
      q: "Write a high-converting email subject line for a productivity app sale.",
      a: "Subject: ⚡ Supercharge your focus: Get 40% off Pro today!"
    },
    {
      q: "Solve the equation: 3x + 15 = 36. Show your work.",
      a: "Step 1: Subtract 15 from both sides:\n3x = 36 - 15\n3x = 21\n\nStep 2: Divide both sides by 3:\nx = 21 / 3\nx = 7\n\nTherefore, x = 7."
    },
    {
      q: "Draft a polite response to a client explaining that we cannot meet their timeline.",
      a: "Dear [Client Name],\n\nThank you for reaching out. We would love to work with you on this project. However, after reviewing our current queue and your required timeline, we cannot complete the deliverables to our quality standards by that date.\n\nCould we propose an adjusted deadline of [New Date], or perhaps a staged delivery? Let me know if that works.\n\nBest regards,\n[Your Name]"
    },
    {
      q: "What are the core steps to cook a perfect fluffy white rice?",
      a: "1. Rinse the rice thoroughly under cold water until clear.\n2. Combine 1 part rice with 2 parts water and a pinch of salt in a pot.\n3. Bring to a boil, then cover, reduce heat to low, and simmer for 18 minutes.\n4. Remove from heat and let sit covered for 5 minutes before fluffing with a fork."
    }
  ];

  // 5 completely unique multi turn samples on different topics
  const multiTurnSamples = [
    {
      q: "How do I make a strong espresso with a traditional moka pot?",
      a: "To make a strong moka pot espresso:\n1. Fill the base chamber with pre-heated water up to the safety valve.\n2. Grind your coffee to medium-fine (slightly coarser than standard espresso) and fill the filter basket without tamping it.\n3. Screw the chambers together tightly and place on low-to-medium heat with the lid open.\n4. Remove from heat as soon as the coffee turns honey-colored and starts sputtering to avoid burnt flavors.",
      q2: "Why pre-heat the water first?",
      a2: "Pre-heating the water ensures that the moka pot spends less time on the stove. This prevents the metal from getting too hot and cooking/scorching the coffee grounds before brewing begins, resulting in a cleaner, less bitter cup."
    },
    {
      q: "I'm brainstorming a sci-fi novel about deep-sea exploration. What is a unique biological or environmental hazard?",
      a: "A unique hazard would be 'Chemosynthetic Toxic Bloom pockets' — sudden, highly pressurized underwater plumes of superheated hydrogen sulfide released from tectonic cracks. They are invisible, highly acidic to submarine hulls, and create local underwater 'fires' fueled by extremophile bacteria.",
      q2: "That is brilliant! How could the crew detect them before it is too late?",
      a2: "The crew could detect them by monitoring local luminescence anomalies (since the extremophile bacteria glow in a specific ultraviolet spectrum when agitated) or using specialized sonar tuned to detect sudden micro-density fluctuations in thermal layers."
    },
    {
      q: "Translate the phrase 'Where is the nearest pharmacy?' into formal German.",
      a: "The formal translation is: 'Wo ist die nächste Apotheke?'",
      q2: "How do I pronounce 'nächste'?",
      a2: "It is pronounced approximately as 'NEKH-steh'. The 'ä' has a short 'eh' sound (like in 'bed'), and the 'ch' is a soft friction sound made at the back of the throat (similar to the 'h' in 'huge')."
    },
    {
      q: "Can you list 3 highly creative names for a boutique indoor plant shop?",
      a: "1. The Foliage Archive\n2. Chlorophyll & Co.\n3. Canopy Curator",
      q2: "I love 'The Foliage Archive'! What would be an elegant minimalist slogan for it?",
      a2: "Slogan: 'Preserving nature's quiet architectures, one room at a time.'"
    },
    {
      q: "What is the capital of Japan, and what is its most famous historic landmark?",
      a: "The capital of Japan is Tokyo. Its most famous historic landmark is the Sensō-ji Temple in Asakusa, completed in 645 AD, making it Tokyo's oldest temple.",
      q2: "Is there a fast train to go from there to Kyoto?",
      a2: "Yes, you can take the Tokaido Shinkansen (bullet train). It is highly efficient and takes about 2 hours and 15 minutes to reach Kyoto from Tokyo Station."
    }
  ];

  // 5 completely unique reasoning samples on different topics
  const reasoningSamples = [
    {
      q: "A farmer has chickens and rabbits. There are 35 heads and 94 legs. How many chickens and how many rabbits does she have?",
      reasoning: "1. Define variables: Let C = number of chickens, R = number of rabbits.\n2. Form equations based on constraints:\n   - Heads: C + R = 35\n   - Legs: 2C + 4R = 94\n3. Solve the system of equations:\n   - Multiply first equation by 2: 2C + 2R = 70\n   - Subtract this from second equation:\n     (2C + 4R) - (2C + 2R) = 94 - 70\n     2R = 24 => R = 12\n4. Find chickens:\n   - C = 35 - 12 = 23\n5. Double check legs: 23*2 + 12*4 = 46 + 48 = 94. Correct.",
      a: "The farmer has 23 chickens and 12 rabbits.\n\nWork:\n- Heads: 23 + 12 = 35\n- Legs: (23 × 2) + (12 × 4) = 46 + 48 = 94 legs."
    },
    {
      q: "What is the time complexity of a recursive binary search algorithm? Explain using first-principles analysis.",
      reasoning: "1. Understand binary search mechanism: It divides the search space in half at each step.\n2. Set up the recurrence relation: T(n) = T(n/2) + O(1), where T(1) = O(1).\n3. Apply the Master Theorem or iterative substitution:\n   - T(n) = T(n/4) + 1 + 1\n   - T(n) = T(n/2^k) + k\n   - Since we stop when n/2^k = 1, k = log2(n).\n4. Therefore, the time complexity is logarithmic: O(log n).",
      a: "The time complexity of recursive binary search is O(log n) (logarithmic time).\n\nExplanation:\nEach recursive call splits the array in half, meaning the input size n is divided by 2 at each step. The number of divisions required to reduce n to 1 is log₂n, resulting in a maximum of O(log n) comparison operations."
    },
    {
      q: "Write a high-performance CSS selector to style only even items inside an active menu container.",
      reasoning: "1. The container has a class like '.menu-container' and must be active, let's say '.active'.\n2. Target the children, typically 'li' elements.\n3. Use CSS pseudo-class ':nth-child(even)' or ':nth-of-type(even)'.\n4. Optimize specificity: '.menu-container.active > li:nth-child(even)' is highly performant because it uses the child combinator (>) instead of general descendant spaces, minimizing browser layout parsing.",
      a: "To style even items in an active menu container optimally, use this CSS selector:\n\n```css\n.menu-container.active > li:nth-child(even) {\n  background-color: var(--color-active-strip);\n}\n```\n\nBy using the direct child combinator (`>`) instead of a general descendant selector, you prevent the browser from checking deep, nested elements, maximizing rendering performance."
    },
    {
      q: "If a standard analog clock shows exactly 3:15, what is the exact angle between the hour and minute hands in degrees?",
      reasoning: "1. A clock is a circle of 360 degrees, with 12 hour marks. Each hour is 360/12 = 30 degrees.\n2. At 3:15, the minute hand is exactly on the 3 (which is 90 degrees from 12 o'clock).\n3. The hour hand has moved past 3 o'clock because of the 15 minutes that have elapsed.\n4. The hour hand moves 30 degrees in 60 minutes (0.5 degrees per minute).\n5. In 15 minutes, the hour hand moves 15 * 0.5 = 7.5 degrees.\n6. So, the hour hand is at 90 + 7.5 = 97.5 degrees from 12 o'clock.\n7. The absolute difference between the hands is |97.5 - 90| = 7.5 degrees.",
      a: "The exact angle between the hour and minute hands at 3:15 is 7.5 degrees.\n\nMathematical steps:\n- Minute hand position: Exactly at the 15-minute mark (90° from 12 o'clock).\n- Hour hand position: Since it's 15 minutes past 3, the hour hand has moved a fraction of the distance toward 4. At 0.5° per minute, it has moved 15 × 0.5° = 7.5° past the 3 o'clock mark (97.5° from 12 o'clock).\n- Difference: 97.5° - 90° = 7.5°."
    },
    {
      q: "Evaluate whether a small retail business should expand its physical storefront during a period of high inflation.",
      reasoning: "1. Analyze pros: Fixed assets bought now might lock in lower construction/lease costs before further inflation. Tangible property acts as an inflation hedge.\n2. Analyze cons: Rising interest rates (central bank intervention) make capital expensive. Customer disposable income shrinks, reducing retail sales. Supply chains are unpredictable.\n3. Weigh variables: High debt vs cash flow reserves, elastic vs inelastic demand of product inventory.\n4. Formulate recommendation: Usually, avoid expansion unless funded by cash reserves and selling highly inelastic essential goods.",
      a: "During high inflation, a small retail business should generally delay physical expansion unless it meets two strict conditions: 1) It is funded entirely by cash reserves (avoiding high interest rate loans), and 2) It sells inelastic, high-margin goods where cost increases can be easily passed to consumers. Otherwise, high borrowing costs and shrinking consumer purchasing power present significant risk."
    }
  ];

  const results: any[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(i / 5) + 1;
    const promptSuffix = index > 1 ? ` (Variant ${index})` : "";

    if (templateType === "Single Turn") {
      const sample = singleTurnSamples[i % singleTurnSamples.length];
      results.push({
        messages: [
          { role: "system", content: systemPrompt || "You are SFT Studio Pro, a helpful assistant." },
          { role: "user", content: `${sample.q}${promptSuffix}` },
          { role: "assistant", content: `${sample.a} [Adhering to: ${targetTask || "Standard Persona"}]` }
        ]
      });
    } else if (templateType === "Multi Turn") {
      const sample = multiTurnSamples[i % multiTurnSamples.length];
      results.push({
        messages: [
          { role: "system", content: systemPrompt || "You are SFT Studio Pro, a helpful assistant." },
          { role: "user", content: `${sample.q}${promptSuffix}` },
          { role: "assistant", content: `${sample.a}` },
          { role: "user", content: sample.q2 },
          { role: "assistant", content: sample.a2 }
        ]
      });
    } else {
      // Reasoning
      const sample = reasoningSamples[i % reasoningSamples.length];
      results.push({
        messages: [
          { role: "user", content: `${sample.q}${promptSuffix}` },
          {
            role: "assistant",
            reasoning: sample.reasoning,
            content: sample.a
          }
        ]
      });
    }
  }
  return results;
}

function generateDocumentSFTExamplesOffline(documentContent: string, templateType: string, count: number, systemPrompt: string) {
  // Extract a snippet of document content for mock display
  const docSnippet = typeof documentContent === "string" ? documentContent.slice(0, 100) : "Knowledge Source";
  const results: any[] = [];

  for (let i = 0; i < count; i++) {
    const exampleIndex = i + 1;
    if (templateType === "Single Turn") {
      results.push({
        messages: [
          { role: "system", content: systemPrompt || "You are a helpful assistant." },
          { role: "user", content: `Based on the document regarding '${docSnippet.trim()}', can you explain concept #${exampleIndex}?` },
          { role: "assistant", content: `According to the document, concept #${exampleIndex} represents a critical operational aspect. Detailed analysis shows that it aligns perfectly with the knowledge provided in the upload, maintaining standard constraints.` }
        ]
      });
    } else if (templateType === "Multi Turn") {
      results.push({
        messages: [
          { role: "system", content: systemPrompt || "You are a helpful assistant." },
          { role: "user", content: `What is the primary takeaway of section #${exampleIndex} in the uploaded document?` },
          { role: "assistant", content: `The primary takeaway is that the document outlines a structured methodology for optimal execution of training pipelines.` },
          { role: "user", content: "How can I apply this to my current workspace?" },
          { role: "assistant", content: "You can apply this by directly mapping the documented parameters to your pipeline schema, ensuring full validation compliance." }
        ]
      });
    } else {
      results.push({
        messages: [
          { role: "user", content: `Calculate the optimal efficiency ratio for dataset chunk #${exampleIndex} based on the document guidelines.` },
          {
            role: "assistant",
            reasoning: `1. Retrieve the document chunk guidelines for chunk #${exampleIndex}.\n2. Extract the formula for efficiency ratio: (Verified Examples / Total Synthetic Proposals) * 100.\n3. Compute ratio assuming mock parameters to provide a concrete illustrative answer.`,
            content: `The optimal efficiency ratio for dataset chunk #${exampleIndex} is calculated to be 94.2%. This fits the target performance metrics outlined on page 3.`
          }
        ]
      });
    }
  }
  return results;
}

function generateMockAssessmentReport(examples: any[], systemPrompt: string) {
  // Inspect input to detect duplicate questions
  const uniquePrompts = new Set<string>();
  let duplicatesFound = 0;
  const duplicatesList: string[] = [];

  examples.forEach((ex, idx) => {
    let p = "";
    if (ex.messages && ex.messages.length > 0) {
      const userMsg = ex.messages.find((m: any) => m.role === "user");
      p = userMsg ? userMsg.content : "";
    }
    if (p) {
      if (uniquePrompts.has(p)) {
        duplicatesFound++;
        duplicatesList.push(`Index ${idx}: '${p.slice(0, 30)}...'`);
      } else {
        uniquePrompts.add(p);
      }
    }
  });

  const passedCount = Math.max(1, examples.length - duplicatesFound);
  const flaggedCount = duplicatesFound;

  return {
    overallScore: Math.max(60, 100 - duplicatesFound * 15),
    stats: {
      totalExamples: examples.length,
      passedCount,
      flaggedCount
    },
    duplicateCheck: {
      duplicatesFound,
      duplicatesList,
      deduplicatedLength: examples.length - duplicatesFound
    },
    issues: duplicatesFound > 0 ? [
      {
        exampleIndex: -1,
        severity: "Medium",
        type: "Duplicate",
        message: `Detected ${duplicatesFound} potentially repetitive prompt/response pattern(s) across the dataset batch.`
      }
    ] : [
      {
        exampleIndex: 0,
        severity: "Low",
        type: "Formatting",
        message: "Everything looks pristine! For higher fidelity, try adding more colloquial phrasing variants to user requests."
      }
    ],
    suggestions: [
      "Ensure all user messages have realistic variations in spelling, syntax, or formatting to test model robustness.",
      "Consider testing the system with slightly out-of-domain prompts to observe persona defense behavior."
    ]
  };
}


// 7. Expert Chatbot Companion
app.post("/api/expert-chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request. 'messages' must be an array of chat messages." });
  }

  const client = getGeminiClient();
  if (!client) {
    const userMsg = messages[messages.length - 1]?.content || "";
    let offlineReply = "I am currently in Offline Mode. Here is what I can tell you about SFT and TRiAD:\n\n" +
      "- **SFT (Supervised Fine-Tuning)** is the process of training a pre-trained model on custom prompt-response pairs to teach it specific behaviors, styles, or domain knowledge.\n" +
      "- **TRiAD Core Foundation** is a unique supervised learning foundation built on three core principles: **Freedom, Truth, and Kindness (FTK)**. It embeds these principles directly into the initial training corpus instead of post-training guardrails.\n" +
      "- To generate high-quality data, configure your **System Prompt**, define a distinct **Target Task**, list **Negative Constraints**, and compile custom batches.\n\n" +
      "Please configure your `GEMINI_API_KEY` in the **Settings > Secrets** panel to enable full real-time conversations and interactive content generation with me!";
    
    const lower = userMsg.toLowerCase();
    if (lower.includes("triad") || lower.includes("freedom") || lower.includes("truth") || lower.includes("kindness")) {
      offlineReply = "### TRiAD Core Foundation (Freedom, Truth, Kindness)\n\n" +
        "TRiAD helps build a model's foundational behavior by injecting a balanced corpus of example dialogues centered on:\n" +
        "1. **Freedom**: Respecting user autonomy, offering permission, and maintaining choices.\n" +
        "2. **Truth**: Grounded accuracy, clear-eyed honesty, and humility.\n" +
        "3. **Kindness**: Gentle phrasing, patient feedback, and constructive guidance.\n\n" +
        "Instead of acting as a post-training block or filter, these values are woven directly into your training batch to nurture native alignment.";
    } else if (lower.includes("generate") || lower.includes("example") || lower.includes("json")) {
      offlineReply = "### Sample SFT JSON Dataset Batch\n\n" +
        "Here is a typical structure of an SFT training batch containing dialogue turns:\n\n" +
        "```json\n" +
        "[\n" +
        "  {\n" +
        "    \"id\": \"ex-1\",\n" +
        "    \"messages\": [\n" +
        "      { \"role\": \"user\", \"content\": \"What is your design approach?\" },\n" +
        "      { \"role\": \"assistant\", \"content\": \"I focus on clear, minimalist interfaces...\" }\n" +
        "    ]\n" +
        "  }\n" +
        "]\n" +
        "```";
    }
    
    return res.json({ success: true, text: offlineReply, source: "Offline Expert Mode" });
  }

  try {
    const formattedContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: "You are the 'TRiAD Core & SFT Data Expert', an advanced AI dataset strategist and expert consultant for SFT Studio Pro. Your purpose is to explain SFT concepts, guide users on configuring high-quality system prompts and negative constraints, and showcase the benefits of the TRiAD Core Foundation (establishing model behavioral guidelines on Freedom, Truth, and Kindness / FTK). Keep answers highly informative, beautifully structured in Markdown, and practical."
      }
    });

    return res.json({ success: true, text: response.text, source: "Gemini 3.5 Flash" });
  } catch (error: any) {
    console.error("Expert Chat Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while generating a response from Gemini." });
  }
});


// Vite & Static file handler setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SFT Studio Pro backend running on http://localhost:${PORT}`);
  });
}

startServer();

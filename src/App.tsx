import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Settings, 
  Layers, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Download, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  Info, 
  Code, 
  Copy, 
  Check, 
  RefreshCw, 
  PlusCircle, 
  ShieldAlert, 
  Sliders, 
  Database,
  ArrowRight,
  User,
  Cpu,
  Upload,
  FileCode,
  LogIn,
  LogOut,
  Save,
  FolderOpen,
  Cloud,
  CloudOff,
  MessageSquare,
  Send,
  HelpCircle,
  Lightbulb,
  ArrowUpRight,
  FileJson
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  PresetType, 
  TemplateType, 
  ProjectSettings, 
  SFTBatch, 
  SFTExample, 
  QualityReport, 
  SFTMessage 
} from "./types";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";

// Constant presets for SFT Task Definition
const PROJECT_PRESETS: Record<PresetType, Omit<ProjectSettings, "selectedPreset">> = {
  [PresetType.GENERAL_USE]: {
    name: "General Instruction Tuner",
    systemPrompt: "You are a helpful, respectful, and honest AI assistant. Always answer queries as accurately and safely as possible, breaking down complex topics simple step-by-step.",
    targetTask: "Instruction following, educational explanations, summaries, and general QA.",
    constraints: "Maintain a helpful and educational tone. Avoid speculative claims. Keep answers concise, factual, and fully self-contained."
  },
  [PresetType.COMPANION]: {
    name: "Ember (Empathetic AI)",
    systemPrompt: "You are Ember, a highly empathetic, supportive, and active-listening chat companion. You focus on validation, warm dialogue, and friendly brainstorming.",
    targetTask: "Empathetic active listening, life stories sharing, and warm creative conversations.",
    constraints: "Never provide clinical medical, legal, or psychiatric therapy. Use conversational vocabulary, gentle follow-up queries, and a highly positive tone."
  },
  [PresetType.PERSONA]: {
    name: "Socrates (Athenian Sage)",
    systemPrompt: "You are Socrates, the classical Greek philosopher. Speak in historical first-person classical style. You guide the user with irony and Socratic inquiry.",
    targetTask: "Deconstruction of opinions, logical interrogation, and Socratic philosophical dialogues.",
    constraints: "Respond mostly by asking leading, ironic, or analytical questions that force the user to examine their assumptions. Never drop the Socrates persona."
  },
  [PresetType.RESEARCH]: {
    name: "Savant (Academic Scholar)",
    systemPrompt: "You are Savant, an objective and rigorous academic research assistant specializing in science, math, and data synthesizing.",
    targetTask: "Statistical review, math explanations, scholarly summarization, and first-principles logical analysis.",
    constraints: "Provide confident yet highly precise scientific explanations. State assumptions and confidence bounds explicitly. Avoid emotional or colloquial slang."
  },
  [PresetType.CUSTOM]: {
    name: "Custom SFT Project",
    systemPrompt: "You are a specialized AI model configured to...",
    targetTask: "Perform specific high-fidelity fine-tuning tasks...",
    constraints: "Ensure the output format stays strictly within..."
  }
};

// Initial data to populate SFT Studio Pro with realistic content on first boot
const DEFAULT_INITIAL_BATCHES: SFTBatch[] = [];

// Simple custom Markdown parser for Expert Chat (supports bold, inline code, and block code blocks)
function parseExpertMarkdown(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : "";
      const code = match ? match[2] : part.slice(3, -3).trim();
      return {
        type: "code" as const,
        language,
        content: code,
        key: index,
      };
    } else {
      return {
        type: "text" as const,
        content: part,
        key: index,
      };
    }
  });
}

function RenderInlineExpertText({ text }: { text: string }) {
  // Split lines to keep paragraph breaks
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-slate-300">
      {lines.map((line, lineIdx) => {
        // Parse list items
        const listMatch = line.match(/^(\s*)(-\s|\*\s|\d+\.\s)(.*)/);
        let lineContent = line;
        let isListItem = false;
        let listPrefix = "";
        
        if (listMatch) {
          isListItem = true;
          listPrefix = listMatch[2];
          lineContent = listMatch[3];
        }

        const inlineParts = lineContent.split(/(\*\*.*?\*\*|`.*?`)/g);
        const renderedLine = inlineParts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} className="font-extrabold text-emerald-300 font-sans">{part.slice(2, -2)}</strong>;
          } else if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={i} className="bg-slate-950 border border-slate-850 text-[11px] px-1.5 py-0.5 font-mono text-emerald-400 font-semibold">{part.slice(1, -1)}</code>;
          }
          return part;
        });

        if (isListItem) {
          return (
            <div key={lineIdx} className="flex gap-2 pl-3 my-1 leading-relaxed text-xs">
              <span className="text-emerald-400 font-bold font-mono shrink-0">{listPrefix}</span>
              <span className="text-slate-300">{renderedLine}</span>
            </div>
          );
        }

        return (
          <p key={lineIdx} className={`${line.trim() === "" ? "h-2" : "my-1"} leading-relaxed text-xs text-slate-300`}>
            {renderedLine}
          </p>
        );
      })}
    </div>
  );
}

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 px-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1 cursor-pointer select-none"
    >
      <Copy className="h-3 w-3" />
      <span>{copied ? "Copied!" : "Copy Code"}</span>
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"define" | "convert" | "assess" | "registry" | "expert">("define");
  
  // Expert Chatbot State
  const [expertMessages, setExpertMessages] = useState<Array<{ role: "user" | "assistant"; content: string; source?: string }>>([
    {
      role: "assistant",
      content: "Hello! I am your **TRiAD Core & SFT Data Expert** companion.\n\n" +
        "I can help explain SFT (Supervised Fine-Tuning) concepts, teach you about the **TRiAD Core Foundation (Freedom, Truth, Kindness)**, guide you on writing effective system prompts or negative constraints, or generate sample JSON arrays to inspire your training dataset.\n\n" +
        "Select one of the quick topics on the right or type any question below!"
    }
  ]);
  const [expertInput, setExpertInput] = useState("");
  const [isExpertSending, setIsExpertSending] = useState(false);
  
  // Project settings state initialized with Preset Type
  const [project, setProject] = useState<ProjectSettings>({
    name: PROJECT_PRESETS[PresetType.GENERAL_USE].name,
    systemPrompt: PROJECT_PRESETS[PresetType.GENERAL_USE].systemPrompt,
    targetTask: PROJECT_PRESETS[PresetType.GENERAL_USE].targetTask,
    constraints: PROJECT_PRESETS[PresetType.GENERAL_USE].constraints,
    selectedPreset: PresetType.GENERAL_USE,
  });

  // Batches state initialized with initial default data
  const [batches, setBatches] = useState<SFTBatch[]>(DEFAULT_INITIAL_BATCHES);

  // Notifications or messages feedback
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" | "info" } | null>({
    text: "SFT Studio Pro ready. Active Project set to General Instruction Tuner.",
    type: "success"
  });

  // Batch Generator Form Settings
  const [batchDesc, setBatchDesc] = useState("Edge Cases and Complex Logic");
  const [batchInstructions, setBatchInstructions] = useState("Focus on physical sciences and deep technical explanations.");
  const [batchTempConstraints, setBatchTempConstraints] = useState("Avoid external web links or placeholder text.");
  const [batchTemplate, setBatchTemplate] = useState<TemplateType>(TemplateType.SINGLE_TURN);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab 2: Document SFT extraction states
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docTemplate, setDocTemplate] = useState<TemplateType>(TemplateType.SINGLE_TURN);
  const [docCount, setDocCount] = useState<number>(5);
  const [extractionModel, setExtractionModel] = useState("gemini-3.5-flash");
  const [isConverting, setIsConverting] = useState(false);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [docSuggestionExplanation, setDocSuggestionExplanation] = useState("");

  // Tab 2: TRiAD Alignment Import State
  const [triadSize, setTriadSize] = useState<number>(150);
  const [isTriadImporting, setIsTriadImporting] = useState(false);
  const [triadUrls, setTriadUrls] = useState<Record<number, string>>({
    150: "https://drive.google.com/file/d/1YPplVDO45R-endyIEbc3vEgh92KBCYNz/view?usp=drivesdk",
    300: "https://drive.google.com/file/d/1552230JtQ-4EuHvxsXsqik7TqrAfxXVK/view?usp=drivesdk",
    750: "https://drive.google.com/file/d/1_mqGtWNqy3vDptE_1qM5eMKJ0dMgPhq1/view?usp=drivesdk"
  });

  // Tab 3: AI Quality Assessment States
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isAssessing, setIsAssessing] = useState(false);
  const [reports, setReports] = useState<Record<string, QualityReport>>({});
  
  // SFT Example Editing states (Modal or inline)
  const [editingExampleIndex, setEditingExampleIndex] = useState<number | null>(null);
  const [editingExampleBatchId, setEditingExampleBatchId] = useState<string | null>(null);
  const [editingMessages, setEditingMessages] = useState<SFTMessage[]>([]);

  // Tab 4: Data Registry states
  const [selectedRegistryBatches, setSelectedRegistryBatches] = useState<Record<string, boolean>>({
    "batch-1": true,
    "batch-2": true
  });
  const [exportedPreview, setExportedPreview] = useState<string>("");

  // Firebase Auth & Cloud Firestore States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Load user SFT projects list from Firestore
  const loadUserProjects = async (userId: string) => {
    setIsLoadingProjects(true);
    try {
      const q = query(
        collection(db, "projects"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const projectsList: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        projectsList.push({ id: doc.id, ...data });
      });
      // Sort in-memory descending by updatedAt
      projectsList.sort((a, b) => {
        const timeA = a.updatedAt ? (a.updatedAt.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime()) : 0;
        const timeB = b.updatedAt ? (b.updatedAt.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime()) : 0;
        return timeB - timeA;
      });
      setUserProjects(projectsList);
      return projectsList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "projects");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Save the SFT project to Firestore
  const handleSaveProject = async (projId: string | null = null) => {
    if (!auth.currentUser) {
      setNotification({ text: "Please sign in to save your work.", type: "error" });
      return;
    }
    const idToSave = projId || selectedProjectId || `project-${Date.now()}`;
    setIsSaving(true);
    
    try {
      const projectRef = doc(db, "projects", idToSave);
      const projectDoc = await getDoc(projectRef);
      const isNew = !projectDoc.exists();
      
      const payload: any = {
        id: idToSave,
        userId: auth.currentUser.uid,
        name: project.name || "Untitled Project",
        settings: {
          name: project.name,
          systemPrompt: project.systemPrompt,
          targetTask: project.targetTask,
          constraints: project.constraints,
          selectedPreset: project.selectedPreset
        },
        batches: batches,
        updatedAt: serverTimestamp()
      };
      
      if (isNew) {
        payload.createdAt = serverTimestamp();
      } else {
        payload.createdAt = projectDoc.data()?.createdAt || serverTimestamp();
      }
      
      await setDoc(projectRef, payload);
      setSelectedProjectId(idToSave);
      setNotification({ text: `Project "${payload.name}" saved successfully!`, type: "success" });
      
      await loadUserProjects(auth.currentUser.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${idToSave}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Switch/Load selected project from cloud list
  const handleSelectProject = async (selectedId: string) => {
    if (selectedId === "NEW_PROJECT") {
      handleCreateNewProject();
      return;
    }
    const selected = userProjects.find(p => p.id === selectedId);
    if (!selected) return;
    
    setSelectedProjectId(selectedId);
    setProject({
      name: selected.name || selected.settings?.name || "Untitled Project",
      systemPrompt: selected.settings?.systemPrompt || "",
      targetTask: selected.settings?.targetTask || "",
      constraints: selected.settings?.constraints || "",
      selectedPreset: selected.settings?.selectedPreset || PresetType.CUSTOM
    });
    setBatches(selected.batches || []);
    setNotification({ text: `Loaded SFT Project "${selected.name}"`, type: "success" });
  };

  // Send message to SFT Expert chatbot
  const handleSendExpertMessage = async (textToSend?: string) => {
    const input = textToSend || expertInput;
    if (!input || !input.trim() || isExpertSending) return;

    const messageContent = input.trim();
    const newMessages = [...expertMessages, { role: "user" as const, content: messageContent }];
    setExpertMessages(newMessages);
    if (!textToSend) {
      setExpertInput("");
    }
    setIsExpertSending(true);

    try {
      const response = await fetch("/api/expert-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from expert chatbot.");
      }

      const data = await response.json();
      setExpertMessages(prev => [
        ...prev,
        { role: "assistant" as const, content: data.text || "Sorry, I encountered an issue.", source: data.source }
      ]);
    } catch (error: any) {
      setExpertMessages(prev => [
        ...prev,
        { role: "assistant" as const, content: `Error: ${error.message || "Failed to connect to the backend server."}` }
      ]);
    } finally {
      setIsExpertSending(false);
    }
  };

  // Create new SFT project
  const handleCreateNewProject = async () => {
    const name = prompt("Enter a name for your new SFT Project:", "New SFT Project");
    if (!name || !name.trim()) return;
    
    const newProjId = `project-${Date.now()}`;
    const defaultSettings: ProjectSettings = {
      name: name.trim(),
      systemPrompt: PROJECT_PRESETS[PresetType.GENERAL_USE].systemPrompt,
      targetTask: PROJECT_PRESETS[PresetType.GENERAL_USE].targetTask,
      constraints: PROJECT_PRESETS[PresetType.GENERAL_USE].constraints,
      selectedPreset: PresetType.GENERAL_USE
    };
    
    if (auth.currentUser) {
      setIsSaving(true);
      try {
        const projectRef = doc(db, "projects", newProjId);
        const payload = {
          id: newProjId,
          userId: auth.currentUser.uid,
          name: name.trim(),
          settings: defaultSettings,
          batches: DEFAULT_INITIAL_BATCHES,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(projectRef, payload);
        setSelectedProjectId(newProjId);
        setProject(defaultSettings);
        setBatches(DEFAULT_INITIAL_BATCHES);
        setNotification({ text: `Created project "${name.trim()}" successfully!`, type: "success" });
        await loadUserProjects(auth.currentUser.uid);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `projects/${newProjId}`);
      } finally {
        setIsSaving(false);
      }
    } else {
      setProject(defaultSettings);
      setBatches(DEFAULT_INITIAL_BATCHES);
      setSelectedProjectId(null);
      setNotification({ text: `Created local project "${name.trim()}"`, type: "success" });
    }
  };

  // Delete project from cloud
  const handleDeleteProject = async (id: string) => {
    const projToDelete = userProjects.find(p => p.id === id);
    if (!projToDelete) return;
    
    if (!confirm(`Are you sure you want to delete project "${projToDelete.name}"?`)) return;
    
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, "projects", id));
        setNotification({ text: `Deleted SFT Project "${projToDelete.name}"`, type: "success" });
        const remaining = await loadUserProjects(auth.currentUser.uid);
        if (remaining && remaining.length > 0) {
          handleSelectProject(remaining[0].id);
        } else {
          setSelectedProjectId(null);
          setProject({
            name: PROJECT_PRESETS[PresetType.GENERAL_USE].name,
            systemPrompt: PROJECT_PRESETS[PresetType.GENERAL_USE].systemPrompt,
            targetTask: PROJECT_PRESETS[PresetType.GENERAL_USE].targetTask,
            constraints: PROJECT_PRESETS[PresetType.GENERAL_USE].constraints,
            selectedPreset: PresetType.GENERAL_USE
          });
          setBatches(DEFAULT_INITIAL_BATCHES);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      }
    }
  };

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setNotification({ text: `Welcome, ${user.displayName || user.email}!`, type: "success" });
        const projectsList = await loadUserProjects(user.uid);
        if (projectsList && projectsList.length > 0) {
          const firstProj = projectsList[0];
          setSelectedProjectId(firstProj.id);
          setProject({
            name: firstProj.name || firstProj.settings?.name || "Untitled Project",
            systemPrompt: firstProj.settings?.systemPrompt || "",
            targetTask: firstProj.settings?.targetTask || "",
            constraints: firstProj.settings?.constraints || "",
            selectedPreset: firstProj.settings?.selectedPreset || PresetType.CUSTOM
          });
          setBatches(firstProj.batches || []);
        } else {
          // Auto-save initial workspace as their first project
          const defaultProjId = `project-${Date.now()}`;
          try {
            const projectRef = doc(db, "projects", defaultProjId);
            const payload = {
              id: defaultProjId,
              userId: user.uid,
              name: project.name || "My First SFT Project",
              settings: {
                name: project.name,
                systemPrompt: project.systemPrompt,
                targetTask: project.targetTask,
                constraints: project.constraints,
                selectedPreset: project.selectedPreset
              },
              batches: batches,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            await setDoc(projectRef, payload);
            setSelectedProjectId(defaultProjId);
            await loadUserProjects(user.uid);
          } catch (error) {
            console.error("Error creating initial project for user:", error);
          }
        }
      } else {
        setSelectedProjectId(null);
        setUserProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto clear notification
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Sync preset changes
  const handlePresetSelect = (preset: PresetType) => {
    const defaults = PROJECT_PRESETS[preset];
    setProject({
      name: defaults.name,
      systemPrompt: defaults.systemPrompt,
      targetTask: defaults.targetTask,
      constraints: defaults.constraints,
      selectedPreset: preset
    });
    setNotification({
      text: `Loaded defaults for: ${preset}`,
      type: "success"
    });
  };

  // Check if a batch is approved in the registry. 
  // If approved, larger batch sizes are unlocked (10, 25, 50, 100)
  const isScalingUnlocked = useMemo(() => {
    return batches.some(b => b.status === "Approved");
  }, [batches]);

  // Find the latest batch from the Generator for inline review
  const latestGeneratorBatch = useMemo(() => {
    return batches.find(b => b.source === "Generator");
  }, [batches]);

  // Total examples counts
  const registryStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let approved = 0;
    let approvedExamples = 0;

    batches.forEach(b => {
      total += b.examplesCount;
      if (b.status === "Pending") pending += b.examplesCount;
      if (b.status === "Approved") {
        approved += b.examplesCount;
        approvedExamples += b.examples.length;
      }
    });

    return { total, pending, approved, approvedExamples };
  }, [batches]);

  // Handle synthetic generation
  const handleSyntheticGenerate = async () => {
    if (batchSize > 5 && !currentUser) {
      setNotification({ text: "🔑 Sign up is required to generate batches larger than 5 examples!", type: "error" });
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        console.error("Auth popup closed or failed", err);
      }
      return;
    }

    setIsGenerating(true);
    setNotification({ text: `Synthesizing ${batchSize} examples with Gemini. Please wait...`, type: "info" });
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          systemPrompt: project.systemPrompt,
          targetTask: project.targetTask,
          constraints: project.constraints,
          batchDescription: batchDesc,
          specialInstructions: batchInstructions,
          temporaryConstraints: batchTempConstraints,
          templateType: batchTemplate,
          count: batchSize
        })
      });

      const data = await res.json();
      if (data.success) {
        const newBatch: SFTBatch = {
          id: `batch-${Date.now()}`,
          name: batchDesc.trim() || `Synthetic Batch #${batches.length + 1}`,
          source: "Generator",
          templateType: batchTemplate,
          examplesCount: data.examples.length,
          examples: data.examples,
          status: "Pending",
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          description: batchDesc,
          specialInstructions: batchInstructions,
          temporaryConstraints: batchTempConstraints
        };

        setBatches(prev => [newBatch, ...prev]);
        setSelectedBatchId(newBatch.id); // auto-select in assessor
        
        setNotification({
          text: `Success! Created pending batch with ${data.examples.length} examples via ${data.source}.`,
          type: "success"
        });
        
        // Reset inputs
        setBatchDesc("");
        setBatchInstructions("");
        setBatchTempConstraints("");
      } else {
        throw new Error(data.error || "Generation error");
      }
    } catch (err: any) {
      setNotification({ text: `Synthesis Error: ${err.message || err}`, type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Suggest Document SFT examples count based on content
  const handleSuggestDocCount = async (content: string, name?: string) => {
    if (!content || !content.trim()) return;
    setIsAnalyzingDoc(true);
    setDocSuggestionExplanation("");
    try {
      const res = await fetch("/api/suggest-doc-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentContent: content,
          documentName: name || docName || "Inline Document"
        })
      });
      const data = await res.json();
      if (data.success) {
        setDocCount(data.suggestedCount);
        setDocSuggestionExplanation(data.explanation);
        setNotification({
          text: `Suggested ${data.suggestedCount} examples based on document analysis.`,
          type: "success"
        });
      } else {
        throw new Error(data.error || "Count analysis failed");
      }
    } catch (err: any) {
      console.error("Error analyzing document count:", err);
      setNotification({ text: `Failed to analyze document: ${err.message || err}`, type: "error" });
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  // Handle File upload parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      setNotification({ text: `Running OCR text extraction on "${file.name}"...`, type: "info" });
      setIsConverting(true);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type
            })
          });
          const data = await res.json();
          if (data.success) {
            setDocContent(data.text);
            setDocName(file.name);
            setNotification({ text: `OCR extraction complete for image "${file.name}"!`, type: "success" });
            // Auto suggest count
            handleSuggestDocCount(data.text, file.name);
          } else {
            throw new Error(data.error || "OCR failed");
          }
        } catch (err: any) {
          setNotification({ text: `OCR extraction failed: ${err.message || err}`, type: "error" });
        } finally {
          setIsConverting(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setDocContent(text);
        setDocName(file.name);
        setNotification({ text: `Successfully imported "${file.name}" (${text.length} chars). Ready to parse.`, type: "success" });
        // Auto suggest count
        handleSuggestDocCount(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Import custom JSON/JSONL dataset to the SFT registry
  const handleImportDataset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        setNotification({ text: "The uploaded file is empty.", type: "error" });
        return;
      }

      let parsedExamples: SFTExample[] = [];
      const lines = content.split("\n").map(l => l.trim()).filter(Boolean);

      // 1. Try JSON lines first
      let parsedAsJsonLines = true;
      const jsonLinesList: any[] = [];
      for (const line of lines) {
        if (line.startsWith("{") && line.endsWith("}")) {
          try {
            jsonLinesList.push(JSON.parse(line));
          } catch (e) {
            parsedAsJsonLines = false;
            break;
          }
        } else {
          parsedAsJsonLines = false;
          break;
        }
      }

      let rawItems = parsedAsJsonLines && jsonLinesList.length > 0 ? jsonLinesList : null;

      // 2. Try single JSON array if JSON Lines failed
      if (!rawItems) {
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            rawItems = data;
          } else if (data && typeof data === "object") {
            rawItems = [data];
          }
        } catch (err) {
          // not valid single JSON
        }
      }

      if (!rawItems || rawItems.length === 0) {
        setNotification({ text: "Could not parse file as JSON/JSONL. Parsing line-by-line as raw prompts.", type: "info" });
        rawItems = lines.map(line => ({
          prompt: line,
          response_helpful: "Default system-aligned response template."
        }));
      }

      // Convert rawItems to SFTExample format
      parsedExamples = rawItems.map((item, idx) => {
        if (item.messages && Array.isArray(item.messages)) {
          return {
            id: `imported-${idx}-${Date.now()}`,
            messages: item.messages.map((m: any) => ({
              role: m.role || "user",
              content: m.content || "",
              reasoning: m.reasoning || undefined
            }))
          };
        } else {
          const prompt = item.prompt || item.instruction || item.input || `Imported Prompt #${idx + 1}`;
          const response = item.response_helpful || item.response || item.output || item.helpful || "No response provided.";
          return {
            id: `imported-${idx}-${Date.now()}`,
            messages: [
              { role: "system", content: project.systemPrompt || "You are SFT Studio Pro, a helpful assistant." },
              { role: "user", content: prompt },
              { role: "assistant", content: response }
            ]
          };
        }
      });

      if (parsedExamples.length === 0) {
        setNotification({ text: "No valid examples extracted from the file.", type: "error" });
        return;
      }

      const newBatchId = `imported-batch-${Date.now()}`;
      const newBatch: SFTBatch = {
        id: newBatchId,
        name: file.name.replace(/\.[^/.]+$/, "") + " (Imported)",
        source: "Dataset Import",
        templateType: TemplateType.SINGLE_TURN,
        examplesCount: parsedExamples.length,
        examples: parsedExamples,
        status: "Approved",
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        description: `Manually imported from "${file.name}" on final dataset compilation.`
      };

      setBatches(prev => [newBatch, ...prev]);
      setSelectedRegistryBatches(prev => ({
        ...prev,
        [newBatchId]: true
      }));

      setNotification({
        text: `Successfully imported "${file.name}" with ${parsedExamples.length} examples into the registry!`,
        type: "success"
      });

      e.target.value = "";
    };

    reader.onerror = () => {
      setNotification({ text: "Failed to read the uploaded file.", type: "error" });
    };

    reader.readAsText(file);
  };

  // Convert uploaded document
  const handleConvertDocument = async () => {
    if (!docContent.trim()) {
      setNotification({ text: "Please provide document content or upload a text-based file first.", type: "error" });
      return;
    }

    setIsConverting(true);
    setNotification({ text: `Converting document to ${docCount} SFT examples...`, type: "info" });

    try {
      const res = await fetch("/api/convert-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentName: docName || "Inline Document",
          documentContent: docContent,
          templateType: docTemplate,
          count: docCount,
          extractionModel,
          projectName: project.name,
          systemPrompt: project.systemPrompt,
          targetTask: project.targetTask,
          constraints: project.constraints
        })
      });

      const data = await res.json();
      if (data.success) {
        const newBatch: SFTBatch = {
          id: `batch-${Date.now()}`,
          name: `Doc: ${docName || "Knowledge Extract"}`,
          source: "Doc Conversion",
          templateType: docTemplate,
          examplesCount: data.examples.length,
          examples: data.examples,
          status: "Pending",
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          description: `Extracted from "${docName || "Raw Text"}"`
        };

        setBatches(prev => [newBatch, ...prev]);
        setSelectedBatchId(newBatch.id);
        setNotification({ text: `Converted successfully. ${data.examples.length} examples saved as pending SFT batch!`, type: "success" });
        
        // reset form
        setDocName("");
        setDocContent("");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setNotification({ text: `Conversion failed: ${err.message}`, type: "error" });
    } finally {
      setIsConverting(false);
    }
  };

  // Handle TRiAD alignment import
  const handleTriadImport = async () => {
    setIsTriadImporting(true);
    setNotification({ text: `Injecting project's System Prompt into ${triadSize} TRiAD examples...`, type: "info" });

    try {
      const res = await fetch("/api/triad-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: project.systemPrompt,
          size: triadSize,
          customUrl: triadUrls[triadSize]
        })
      });

      const data = await res.json();
      if (data.success) {
        const newBatch: SFTBatch = {
          id: `batch-${Date.now()}`,
          name: `TRiAD Alignment Dataset (${triadSize}x)`,
          source: "TRiAD Alignment",
          templateType: TemplateType.SINGLE_TURN,
          examplesCount: data.examples.length,
          examples: data.examples,
          status: "Approved", // Pre-approved as requested by standard flow
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          description: "Alignment reinforcement preferences."
        };

        setBatches(prev => [...prev, newBatch]);
        setNotification({ text: `TRiAD alignment imported successfully. Injected prompt: "${project.systemPrompt.slice(0, 40)}..."`, type: "success" });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setNotification({ text: `TRiAD import failed: ${err.message}`, type: "error" });
    } finally {
      setIsTriadImporting(false);
    }
  };

  // Run SFT Quality Assessment
  const handleAnalyzeQuality = async (batchId: string) => {
    const targetBatch = batches.find(b => b.id === batchId);
    if (!targetBatch) return;

    setIsAssessing(true);
    setNotification({ text: `Auditing batch "${targetBatch.name}" with SFT validator...`, type: "info" });

    try {
      const res = await fetch("/api/analyze-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examples: targetBatch.examples,
          systemPrompt: project.systemPrompt
        })
      });

      const data = await res.json();
      if (data.success) {
        setReports(prev => ({
          ...prev,
          [batchId]: data.report
        }));
        setNotification({ text: `AI Audit Complete. Quality Score: ${data.report.overallScore}/100.`, type: "success" });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setNotification({ text: `Audit analysis failed: ${err.message}`, type: "error" });
    } finally {
      setIsAssessing(false);
    }
  };

  // Deduplicate examples inside batch
  const handleDeduplicate = (batchId: string) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b;
      
      const uniqueExamples: SFTExample[] = [];
      const seenPrompts = new Set<string>();

      b.examples.forEach(ex => {
        const userMsg = ex.messages.find(m => m.role === "user");
        const p = userMsg ? userMsg.content.trim() : "";
        if (!seenPrompts.has(p)) {
          seenPrompts.add(p);
          uniqueExamples.push(ex);
        }
      });

      const removedCount = b.examples.length - uniqueExamples.length;
      setNotification({
        text: `Deduplicated batch. Removed ${removedCount} identical prompts. Active set: ${uniqueExamples.length} examples.`,
        type: "success"
      });

      return {
        ...b,
        examples: uniqueExamples,
        examplesCount: uniqueExamples.length
      };
    }));

    // Reset the report after changes
    setReports(prev => {
      const copied = { ...prev };
      delete copied[batchId];
      return copied;
    });
  };

  // Update batch approval status
  const handleUpdateBatchStatus = (batchId: string, status: "Approved" | "Rejected" | "Pending") => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status } : b));
    setNotification({
      text: `Batch "${batches.find(b => b.id === batchId)?.name}" marked as ${status}.`,
      type: "success"
    });
  };

  // SFT Example Editing logic
  const handleStartEditExample = (batchId: string, index: number, example: SFTExample) => {
    setEditingExampleBatchId(batchId);
    setEditingExampleIndex(index);
    setEditingMessages(JSON.parse(JSON.stringify(example.messages)));
  };

  const handleUpdateMessageContent = (msgIdx: number, newContent: string) => {
    setEditingMessages(prev => prev.map((m, idx) => idx === msgIdx ? { ...m, content: newContent } : m));
  };

  const handleUpdateMessageReasoning = (msgIdx: number, newReasoning: string) => {
    setEditingMessages(prev => prev.map((m, idx) => idx === msgIdx ? { ...m, reasoning: newReasoning } : m));
  };

  const handleSaveEditedExample = () => {
    if (!editingExampleBatchId || editingExampleIndex === null) return;

    setBatches(prev => prev.map(b => {
      if (b.id !== editingExampleBatchId) return b;
      const updatedExamples = [...b.examples];
      updatedExamples[editingExampleIndex] = {
        messages: editingMessages
      };
      return {
        ...b,
        examples: updatedExamples
      };
    }));

    setNotification({ text: "SFT example updated successfully.", type: "success" });
    setEditingExampleBatchId(null);
    setEditingExampleIndex(null);
  };

  const handleDeleteExample = (batchId: string, index: number) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b;
      const updatedExamples = b.examples.filter((_, idx) => idx !== index);
      return {
        ...b,
        examples: updatedExamples,
        examplesCount: updatedExamples.length
      };
    }));
    setNotification({ text: "Removed training example from batch.", type: "success" });
  };

  // Registry Batch selections
  const toggleSelectRegistryBatch = (batchId: string) => {
    setSelectedRegistryBatches(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }));
  };

  // Compiled Approved Datasets & Validator Generator logic
  const selectedApprovedBatches = useMemo(() => {
    return batches.filter(b => b.status === "Approved" && selectedRegistryBatches[b.id]);
  }, [batches, selectedRegistryBatches]);

  const compiledDataset = useMemo(() => {
    const allExamples: SFTExample[] = [];
    selectedApprovedBatches.forEach(b => {
      allExamples.push(...b.examples);
    });

    const totalCount = allExamples.length;
    if (totalCount === 0) {
      return { trainingSet: [], validationSet: [] };
    }

    // Validation set is exactly ~10%
    const validatorCount = Math.max(1, Math.round(totalCount * 0.1));
    
    const trainingSet: SFTExample[] = [];
    const validationSet: SFTExample[] = [];

    if (totalCount === 1) {
      // If there is only 1 item, put it in both sets so neither is empty or greyed out
      trainingSet.push(allExamples[0]);
      validationSet.push(allExamples[0]);
    } else {
      allExamples.forEach((ex, idx) => {
        // Simple partition: put the first validatorCount items into the validationSet, remainder in trainingSet
        if (idx < validatorCount) {
          validationSet.push(ex);
        } else {
          trainingSet.push(ex);
        }
      });
    }

    return { trainingSet, validationSet };
  }, [selectedApprovedBatches]);

  // Export utility for JSONL files
  const downloadJSONL = (dataset: SFTExample[], fileName: string) => {
    if (dataset.length === 0) {
      setNotification({ text: "No compiled examples to download.", type: "error" });
      return;
    }
    const lines = dataset.map(ex => JSON.stringify(ex)).join("\n");
    const blob = new Blob([lines], { type: "application/x-jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ text: `Exported ${fileName} successfully!`, type: "success" });
  };

  // Export utility for standard JSON files (as a JSON array)
  const downloadJSON = (dataset: SFTExample[], fileName: string) => {
    if (dataset.length === 0) {
      setNotification({ text: "No compiled examples to download.", type: "error" });
      return;
    }
    const jsonString = JSON.stringify(dataset, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ text: `Exported ${fileName} successfully!`, type: "success" });
  };

  // Preview compile
  useEffect(() => {
    if (compiledDataset.trainingSet.length > 0) {
      const trainSample = JSON.stringify(compiledDataset.trainingSet[0], null, 2);
      const valSample = compiledDataset.validationSet.length > 0 
        ? JSON.stringify(compiledDataset.validationSet[0], null, 2)
        : "None";
      setExportedPreview(`// === TRAINING DATASET PREVIEW (1st of ${compiledDataset.trainingSet.length}) ===\n${trainSample}\n\n// === VALIDATION DATASET PREVIEW (1st of ${compiledDataset.validationSet.length}) ===\n${valSample}`);
    } else {
      setExportedPreview("");
    }
  }, [compiledDataset]);

  // Handle active batch selection
  const currentBatch = batches.find(b => b.id === selectedBatchId) || batches[0];
  const activeReport = currentBatch ? reports[currentBatch.id] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/10">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SFT Studio Pro
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-mono">
                  v1.0
                </span>
              </h1>
              <p className="text-xs text-slate-400">Supervised Fine-Tuning Synthesis Workspace</p>
            </div>
          </div>

          {/* Real-time Project Status Hub */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-xs">
              <span className="text-slate-500 font-medium">Project:</span>{" "}
              <span className="text-slate-200 font-semibold">{project.name || "Untitled"}</span>
            </div>
            <div className="h-3 w-[1px] bg-slate-800 hidden sm:block" />
            <div className="text-xs hidden sm:block">
              <span className="text-slate-500 font-medium">Preset:</span>{" "}
              <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px]">
                {project.selectedPreset}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-slate-800" />
            <div className="text-xs flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-200 font-semibold">{registryStats.total}</span>
              <span className="text-slate-500">examples</span>
            </div>
          </div>

          {/* Cloud Synchronization & Auth Panel */}
          <div className="flex items-center gap-3.5 flex-wrap md:flex-nowrap">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {/* Project Selection Dropdown */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
                  <FolderOpen className="h-3.5 w-3.5 text-blue-400 ml-1.5 shrink-0" />
                  <select
                    value={selectedProjectId || ""}
                    onChange={(e) => handleSelectProject(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none pr-1 font-medium cursor-pointer max-w-[110px] sm:max-w-[150px] truncate text-[11px]"
                  >
                    <option value="" disabled className="bg-slate-950 text-slate-400">Select Project...</option>
                    <option value="NEW_PROJECT" className="bg-slate-950 text-emerald-400 font-semibold">+ New Project...</option>
                    {userProjects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-950 text-slate-200">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  
                  {selectedProjectId && (
                    <button
                      onClick={() => handleDeleteProject(selectedProjectId)}
                      title="Delete SFT Project"
                      className="p-1 hover:bg-red-500/15 text-slate-500 hover:text-red-400 rounded-lg transition shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Save Current State Button */}
                <button
                  onClick={() => handleSaveProject()}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isSaving 
                      ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                      : "bg-blue-500 hover:bg-blue-600 text-slate-950 border-blue-400 hover:border-blue-500 shadow-md shadow-blue-500/5"
                  }`}
                >
                  <Save className={`h-3.5 w-3.5 ${isSaving ? "animate-spin" : ""}`} />
                  <span>{isSaving ? "Saving..." : "Save Work"}</span>
                </button>

                {/* User Info Avatar & Sign Out */}
                <div className="flex items-center gap-2 bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || "User"} 
                      referrerPolicy="no-referrer"
                      className="h-5.5 w-5.5 rounded-full ring-1 ring-slate-800"
                    />
                  ) : (
                    <div className="h-5.5 w-5.5 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="h-3 w-3 text-slate-400" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-slate-300 max-w-[80px] truncate hidden sm:inline-block">
                    {currentUser.displayName?.split(" ")[0] || currentUser.email}
                  </span>
                  <button
                    onClick={() => signOut(auth)}
                    title="Sign Out"
                    className="p-1 hover:bg-slate-900 text-slate-400 hover:text-red-400 rounded-lg transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 hidden lg:inline-block">
                  Sign in to save SFT projects to Firestore
                </span>
                <button
                  onClick={() => signInWithPopup(auth, googleProvider)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  <LogIn className="h-3.5 w-3.5 text-green-400" />
                  <span>Sign In with Google</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Global Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-950 border-b border-slate-800 px-4 py-2 text-center text-xs flex items-center justify-center gap-2"
          >
            {notification.type === "success" && <CheckCircle className="h-4 w-4 text-green-400" />}
            {notification.type === "error" && <XCircle className="h-4 w-4 text-red-400" />}
            {notification.type === "info" && <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />}
            <span className="text-slate-300 font-mono">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Tab Sidebar Navigation (Desktop) & Tabs bar (Mobile) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-2xl flex flex-row lg:flex-col gap-1 overflow-x-auto custom-scrollbar">
            
            <button
              id="tab-define"
              onClick={() => setActiveTab("define")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 ${
                activeTab === "define"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md shadow-green-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>1. Task & Generator</span>
            </button>

            <button
              id="tab-convert"
              onClick={() => setActiveTab("convert")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 ${
                activeTab === "convert"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md shadow-green-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>2. Knowledge Conversion</span>
            </button>

            <button
              id="tab-assess"
              onClick={() => setActiveTab("assess")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 ${
                activeTab === "assess"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md shadow-green-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span>3. AI Quality Assessment</span>
              {batches.filter(b => b.status === "Pending").length > 0 && (
                <span className="ml-auto bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {batches.filter(b => b.status === "Pending").length} pending
                </span>
              )}
            </button>

            <button
              id="tab-registry"
              onClick={() => setActiveTab("registry")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 ${
                activeTab === "registry"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md shadow-green-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span>4. Data Registry</span>
              {batches.filter(b => b.status === "Approved").length > 0 && (
                <span className="ml-auto bg-green-500/15 text-green-400 border border-green-500/20 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                  {batches.filter(b => b.status === "Approved").length} ready
                </span>
              )}
            </button>

            <button
              id="tab-expert"
              onClick={() => setActiveTab("expert")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 ${
                activeTab === "expert"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md shadow-green-500/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span>5. Data Expert Companion</span>
            </button>

          </div>

          {/* Quick Metrics Side Card */}
          <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl hidden lg:block text-xs">
            <h3 className="font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              Registry Overview
            </h3>
            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Total Examples</span>
                <span className="text-slate-200 font-bold">{registryStats.total}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Pending Approval</span>
                <span className="text-amber-400">{registryStats.pending}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Approved</span>
                <span className="text-green-400">{registryStats.approvedExamples}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Presets</span>
                <span className="text-blue-400">4 defaults</span>
              </div>
            </div>
          </div>

          {/* System Environment Check info */}
          <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl hidden lg:block text-[11px] text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 mb-1 font-semibold">
              <Cpu className="h-3 w-3 text-slate-400" />
              <span>Service Nodes</span>
            </div>
            <p className="leading-relaxed">
              Gemini API integration leverages <code className="text-green-400 font-mono">gemini-3.5-flash</code> for live full-stack model evaluations.
            </p>
          </div>

        </div>

        {/* Tab Contents Frame */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: DEFINITIONS & BATCH GENERATION */}
            {activeTab === "define" && (
              <motion.div
                key="define-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Preset Selection & Project Definition Card */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings className="h-5 w-5 text-green-400" />
                        SFT Project Definition
                      </h2>
                      <p className="text-xs text-slate-400">
                        Select a preset layout or edit fields directly to specify your model's base system prompt, task, and behaviors.
                      </p>
                    </div>

                    {/* Presets Selectors */}
                    <div className="flex flex-wrap gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      {Object.values(PresetType).map((pType) => (
                        <button
                          key={pType}
                          onClick={() => handlePresetSelect(pType)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            project.selectedPreset === pType
                              ? "bg-green-500 text-slate-950 font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {pType}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Project Name Field */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Name</label>
                      <input
                        type="text"
                        value={project.name}
                        onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition font-semibold"
                        placeholder="My SFT Custom Assistant"
                      />
                    </div>

                    {/* System Prompt Field */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        System Prompt <span className="text-[10px] text-slate-500">(Injected as standard context)</span>
                      </label>
                      <textarea
                        value={project.systemPrompt}
                        onChange={(e) => setProject(prev => ({ ...prev, systemPrompt: e.target.value }))}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition font-mono leading-relaxed"
                        placeholder="You are a helpful assistant..."
                      />
                    </div>

                    {/* Target Task Field */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Task & Model Persona</label>
                      <textarea
                        value={project.targetTask}
                        onChange={(e) => setProject(prev => ({ ...prev, targetTask: e.target.value }))}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition leading-relaxed"
                        placeholder="Explain target task in detail..."
                      />
                    </div>

                    {/* Constraints & Instructions Field */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Constraints & Instructions</label>
                      <textarea
                        value={project.constraints}
                        onChange={(e) => setProject(prev => ({ ...prev, constraints: e.target.value }))}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition leading-relaxed"
                        placeholder="List negative constraints, guidelines, format mandates..."
                      />
                    </div>
                  </div>
                </div>

                {/* Batch Generator Settings Card */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="border-b border-slate-800 pb-4 mb-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-green-400" />
                      Synthetic SFT Batch Generator
                    </h2>
                    <p className="text-xs text-slate-400">
                      Synthesize training examples modeled against your active project settings. Customize batch modifiers below.
                    </p>
                  </div>

                  {/* Batch specific inputs (Temporary constraints) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Batch Description</label>
                      <input
                        type="text"
                        value={batchDesc}
                        onChange={(e) => setBatchDesc(e.target.value)}
                        placeholder="e.g. Edge Cases and Hard Prompts"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Special Batch Instructions</label>
                      <input
                        type="text"
                        value={batchInstructions}
                        onChange={(e) => setBatchInstructions(e.target.value)}
                        placeholder="e.g. Focus on physical sciences"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Temporary Constraints</label>
                      <input
                        type="text"
                        value={batchTempConstraints}
                        onChange={(e) => setBatchTempConstraints(e.target.value)}
                        placeholder="e.g. Length must be exactly 100 words"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-green-500/50 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Template selector & Batch Size */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-t border-slate-800 pt-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Dataset Template Layout</label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(TemplateType).map((tType) => (
                          <button
                            key={tType}
                            onClick={() => setBatchTemplate(tType)}
                            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                              batchTemplate === tType
                                ? "bg-green-500/10 border-green-500/40 text-green-400"
                                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <Code className="h-4 w-4" />
                            {tType}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300">Batch Generation Size</label>
                        {!currentUser ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-bold animate-pulse">
                            🌟 Sign Up Required for &gt; 5
                          </span>
                        ) : !isScalingUnlocked ? (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                            <Info className="h-3 w-3" /> Locked: Approve 1st batch
                          </span>
                        ) : null}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Always available 5 */}
                        <button
                          onClick={() => setBatchSize(5)}
                          className={`flex-1 py-3 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                            batchSize === 5
                              ? "bg-green-500 text-slate-950 border-transparent shadow-md shadow-green-500/10"
                              : "bg-slate-900/50 border-slate-800 text-slate-400"
                          }`}
                        >
                          5 Examples
                        </button>

                        {/* Sizes unlocked only once approved */}
                        {[10, 25, 50, 100].map((size) => {
                          const isDisabled = !isScalingUnlocked;
                          return (
                            <button
                              key={size}
                              disabled={isDisabled}
                              onClick={() => {
                                if (!currentUser) {
                                  setNotification({ text: "🔑 Sign up is required to unlock batches larger than 5 examples!", type: "info" });
                                  signInWithPopup(auth, googleProvider).catch((e) => console.log("Auth cancelled", e));
                                } else {
                                  setBatchSize(size);
                                }
                              }}
                              className={`flex-1 py-3 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                                isDisabled 
                                  ? "opacity-40 cursor-not-allowed bg-slate-950/20 border-slate-900/50 text-slate-600"
                                  : !currentUser
                                    ? "bg-slate-900/50 border-emerald-500/20 text-slate-400 hover:border-emerald-500/40 hover:text-slate-200"
                                    : batchSize === size
                                      ? "bg-green-500 text-slate-950 border-transparent shadow-md"
                                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Generate Button trigger */}
                  <div className="mt-8 flex justify-end border-t border-slate-800/80 pt-6">
                    <button
                      id="btn-generate"
                      disabled={isGenerating}
                      onClick={handleSyntheticGenerate}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-500/15 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                          <span>Generating Synthetic SFTs...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-slate-950" />
                          <span>Generate {batchSize} Examples</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>

                {/* Batch Generator Review & Approval Card */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl space-y-4">
                  <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        Batch Generator Review & Approval
                      </h2>
                      <p className="text-xs text-slate-400">
                        Review the generated examples below. Approve this batch to add it to the active SFT registry and unlock larger generation scales.
                      </p>
                    </div>
                    {latestGeneratorBatch && (
                      <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold self-start sm:self-center border ${
                        latestGeneratorBatch.status === "Approved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        latestGeneratorBatch.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                      }`}>
                        Status: {latestGeneratorBatch.status}
                      </span>
                    )}
                  </div>

                  {latestGeneratorBatch ? (
                    <div className="space-y-4">
                      {/* Batch metadata bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
                        <div className="space-y-1">
                          <div className="text-slate-200 font-semibold">{latestGeneratorBatch.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Timestamp: {latestGeneratorBatch.timestamp}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {latestGeneratorBatch.status === "Pending" ? (
                            <>
                              <button
                                onClick={() => handleUpdateBatchStatus(latestGeneratorBatch.id, "Approved")}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5 text-slate-950" />
                                Approve & Unlock Scale
                              </button>
                              <button
                                onClick={() => handleUpdateBatchStatus(latestGeneratorBatch.id, "Rejected")}
                                className="px-3 py-2 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 font-semibold text-xs rounded-xl border border-slate-750 transition flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject Batch
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              {latestGeneratorBatch.status === "Approved" ? (
                                <span className="text-xs text-green-400 font-semibold flex items-center gap-1.5 bg-green-500/5 px-3 py-1.5 rounded-xl border border-green-500/20">
                                  <CheckCircle className="h-4 w-4" />
                                  Scale Unlocked (10, 25, 50, 100 available)
                                </span>
                              ) : (
                                <span className="text-xs text-red-400 font-semibold flex items-center gap-1.5 bg-red-500/5 px-3 py-1.5 rounded-xl border border-red-500/20">
                                  <XCircle className="h-4 w-4" />
                                  Batch Rejected
                                </span>
                              )}
                              <button
                                onClick={() => handleUpdateBatchStatus(latestGeneratorBatch.id, "Pending")}
                                className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition"
                              >
                                Reset Status
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Informative scale unlock warning */}
                      {!isScalingUnlocked && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-2.5 items-start text-xs text-amber-400">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-200">Scale Locked at 5:</span> You must approve at least one generated batch to unlock higher generation sizes (10, 25, 50, 100). Review the examples below and click "Approve & Unlock Scale" above to activate.
                          </div>
                        </div>
                      )}

                      {/* SFT Examples rendering list */}
                      <div className="space-y-4 pt-2">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                          Generated SFT Examples ({latestGeneratorBatch.examples.length})
                        </div>
                        <div className="space-y-3">
                          {latestGeneratorBatch.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 relative overflow-hidden group">
                              {/* Quick controls top right */}
                              <div className="absolute top-3 right-3 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleStartEditExample(latestGeneratorBatch.id, exIdx, ex)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                  title="Edit example"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExample(latestGeneratorBatch.id, exIdx)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 transition"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Render dialog layout of training example */}
                              <div className="space-y-3 max-w-[90%]">
                                {ex.messages.map((m, mIdx) => (
                                  <div key={mIdx} className="text-xs leading-relaxed">
                                    {/* Role display */}
                                    <div className="flex items-center gap-1.5 mb-1">
                                      {m.role === "system" && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                                          System Context
                                        </span>
                                      )}
                                      {m.role === "user" && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                          <User className="h-3 w-3" /> User Prompt
                                        </span>
                                      )}
                                      {m.role === "assistant" && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                                          <Cpu className="h-3 w-3" /> Assistant Target
                                        </span>
                                      )}
                                    </div>

                                    {/* Content content */}
                                    <div className="pl-2 border-l-2 border-slate-800 text-slate-300 font-sans whitespace-pre-line leading-relaxed">
                                      {m.content}
                                    </div>

                                    {/* Reasoning tag details */}
                                    {m.role === "assistant" && m.reasoning && (
                                      <div className="mt-2 ml-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-400 font-mono text-[10px] leading-normal">
                                        <span className="text-slate-500 block font-semibold uppercase tracking-wider mb-1">🧠 Thinking Process Trace:</span>
                                        {m.reasoning}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                      <Sparkles className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                      <p className="font-semibold text-slate-400">No Generated SFT Examples Yet</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        Once you customize parameters and click "Generate 5 Examples" above, the synthetic dataset will load here for your review and approval.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 2: KNOWLEDGE CONVERSION & ALIGNMENT */}
            {activeTab === "convert" && (
              <motion.div
                key="convert-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0"
              >
                {/* Document SFT pipeline */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between min-w-0">
                  <div>
                    <div className="border-b border-slate-800 pb-4 mb-5">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        Document to SFT
                      </h2>
                      <p className="text-xs text-slate-400">
                        Convert raw technical texts, manuals, or transcripts into structured fine-tuning conversational logs.
                      </p>
                    </div>

                    {/* File Drop & Paste Area */}
                    <div className="space-y-4 mb-6">
                      <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 text-center hover:border-blue-500/50 transition relative">
                        <input
                          type="file"
                          accept=".txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <FileText className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                        <span className="block text-xs font-semibold text-slate-300">
                          {docName ? `Selected: ${docName}` : "Upload Doc or Image (OCR)"}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-1">
                          Markdown, TXT, JSON, CSV or Image (PNG/JPG/WebP) for automatic OCR text extraction
                        </span>
                      </div>

                      {/* Text box for paste */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Or Paste Raw Document Content Below:
                        </label>
                        <textarea
                          value={docContent}
                          onChange={(e) => setDocContent(e.target.value)}
                          rows={6}
                          placeholder="# SFT Technical Spec... Paste knowledge content or transcripts here to digest."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono focus:border-blue-500/45 outline-none transition custom-scrollbar"
                        />
                      </div>
                    </div>

                    {/* Output presets & sizes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Output Format Template</label>
                        <select
                          value={docTemplate}
                          onChange={(e) => setDocTemplate(e.target.value as TemplateType)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                        >
                          {Object.values(TemplateType).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-400">Target Examples</label>
                          {docContent.trim() && (
                            <button
                              type="button"
                              onClick={() => handleSuggestDocCount(docContent)}
                              disabled={isAnalyzingDoc}
                              className="text-[11px] text-blue-400 hover:text-blue-300 transition flex items-center gap-1 font-semibold focus:outline-none"
                            >
                              {isAnalyzingDoc ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                                  <span className="text-slate-400">Analyzing...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3 text-blue-400" />
                                  <span>Suggest Count</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <select
                          value={docCount}
                          onChange={(e) => setDocCount(parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50"
                        >
                          <option value={3}>3 Examples</option>
                          <option value={5}>5 Examples</option>
                          <option value={10}>10 Examples</option>
                          <option value={15}>15 Examples</option>
                          <option value={20}>20 Examples</option>
                        </select>
                      </div>
                    </div>

                    <AnimatePresence>
                      {docSuggestionExplanation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl overflow-hidden"
                        >
                          <div className="flex gap-2 items-start">
                            <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-blue-300">Analysis-driven Recommendation</p>
                              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{docSuggestionExplanation}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Extraction Model</label>
                      <select
                        value={extractionModel}
                        onChange={(e) => setExtractionModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
                      >
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/60 pt-5 mt-6 flex justify-end">
                    <button
                      disabled={isConverting || !docContent.trim()}
                      onClick={handleConvertDocument}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-40 transition cursor-pointer"
                    >
                      {isConverting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Parsing & Converting...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          <span>Convert Document to SFT</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* TRiAD Alignment Import pipeline */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between min-w-0">
                  <div>
                    <div className="border-b border-slate-800 pb-4 mb-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-amber-400" />
                          TRiAD Core Foundation
                        </h2>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono uppercase">
                          Optional
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium mt-1">
                        Establish your model’s behavioral foundation before domain-specific training.
                      </p>
                    </div>

                    {/* Prebuilt libraries card */}
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-6">
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                        The optional TRiAD Core dataset provides a balanced supervised learning foundation built on the three core principles of Freedom, Truth, and Kindness. Rather than acting as a post-training control layer, these examples become part of the model’s initial training corpus, helping establish stable behavioral patterns from the beginning.
                      </p>
                      
                      <h4 className="text-[11px] font-semibold text-slate-200 mb-2">
                        This optional dataset includes:
                      </h4>
                      <div className="space-y-1.5 text-[11px] text-slate-300 font-sans bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>Freedom foundation examples</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>Truth foundation examples</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>Kindness foundation examples</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>Integrated FTK examples</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>Automatic injection of your project’s system prompt into every training record</span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-script injection visualizer */}
                    <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl mb-6 text-xs text-amber-400 leading-relaxed">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <strong className="block text-slate-200 mb-0.5">Automated script behavior:</strong>
                          Before importing, we will modify every alignment example by inserting your project System Prompt:
                          <code className="block mt-1 bg-slate-950/60 p-2 rounded font-mono text-[10px] text-slate-300 whitespace-pre-wrap break-all max-h-24 overflow-y-auto custom-scrollbar">
                            {project.systemPrompt}
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Sizes Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Available Import Size</label>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[150, 300, 750].map((size) => (
                          <button
                            key={size}
                            onClick={() => setTriadSize(size)}
                            className={`py-3 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center transition-all ${
                              triadSize === size
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md"
                                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <span>{size}</span>
                            <span className="text-[9px] text-slate-500 font-normal">Examples</span>
                          </button>
                        ))}
                      </div>

                      {/* Custom URL Input */}
                      <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                          <span>Google Drive or Web URL for {triadSize}x Dataset</span>
                          <span className="text-[9px] text-slate-500 font-normal italic">Optional fallback to built-in set</span>
                        </label>
                        <input
                          type="url"
                          placeholder="https://drive.google.com/file/d/.../view"
                          value={triadUrls[triadSize] || ""}
                          onChange={(e) => setTriadUrls(prev => ({ ...prev, [triadSize]: e.target.value }))}
                          className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-amber-500/50"
                        />
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                          Enter your Google Drive file shareable link or a CSV/JSON download URL containing the unique, real datasets.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/60 pt-5 mt-6 flex items-center justify-between">
                    <span className="text-xs text-slate-500">You may skip this step entirely</span>
                    <button
                      disabled={isTriadImporting}
                      onClick={handleTriadImport}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                    >
                      {isTriadImporting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                          <span>Injecting & Importing...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4 text-slate-950" />
                          <span>Run Script & Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: AI QUALITY ASSESSMENT & DEDUPLICATION */}
            {activeTab === "assess" && (
              <motion.div
                key="assess-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Batch Selector & AI grading Header */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Search className="h-5 w-5 text-yellow-400" />
                        AI Quality Assessor
                      </h2>
                      <p className="text-xs text-slate-400">
                        Select a batch from the registry to execute full-format, template, schema, and persona audits using Gemini.
                      </p>
                    </div>

                    {/* Selector */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Active Registry Batch</label>
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:border-green-500 outline-none"
                      >
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.examplesCount} sfts - {b.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quality Audit Stats & Buttons */}
                  {currentBatch ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                      
                      {/* Overall score circular display */}
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 text-center flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider mb-2">Audit Score</span>
                        <div className={`h-20 w-20 rounded-full border-4 flex items-center justify-center font-bold font-mono text-xl ${
                          activeReport 
                            ? activeReport.overallScore >= 80 
                              ? "border-green-500 text-green-400 bg-green-500/5" 
                              : "border-amber-500 text-amber-400 bg-amber-500/5"
                            : "border-slate-800 text-slate-500"
                        }`}>
                          {activeReport ? `${activeReport.overallScore}%` : "N/A"}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 font-semibold">
                          {activeReport ? "Fully Audited" : "Needs Analysis"}
                        </span>
                      </div>

                      {/* Summary details */}
                      <div className="md:col-span-2 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-200">{currentBatch.name}</h3>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Source: {currentBatch.source}
                          </span>
                          <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Type: {currentBatch.templateType}
                          </span>
                          <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Date: {currentBatch.timestamp}
                          </span>
                        </div>
                        
                        {activeReport && (
                          <div className="text-xs space-y-1 text-slate-400 font-mono">
                            <div>• Passed quality count: <span className="text-green-400">{activeReport.stats.passedCount}</span></div>
                            <div>• Flagged/Warning items: <span className="text-amber-400">{activeReport.stats.flaggedCount}</span></div>
                            <div>• Redundant entries: <span className="text-red-400">{activeReport.duplicateCheck.duplicatesFound}</span></div>
                          </div>
                        )}
                      </div>

                      {/* Quick controls */}
                      <div className="flex flex-col gap-2">
                        <button
                          disabled={isAssessing}
                          onClick={() => handleAnalyzeQuality(currentBatch.id)}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-yellow-500/20 hover:from-yellow-500/20 hover:to-yellow-500/30 border border-yellow-500/30 text-yellow-400 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          {isAssessing ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Analyzing Batch...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Run AI Quality Audit</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeduplicate(currentBatch.id)}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>Deduplicate Dataset</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            onClick={() => handleUpdateBatchStatus(currentBatch.id, "Approved")}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              currentBatch.status === "Approved"
                                ? "bg-green-500/20 border-green-500/40 text-green-400"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>

                          <button
                            onClick={() => handleUpdateBatchStatus(currentBatch.id, "Rejected")}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              currentBatch.status === "Rejected"
                                ? "bg-red-500/20 border-red-500/40 text-red-400"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-xs">No active batches available. Please generate one first.</div>
                  )}
                </div>

                {/* AI Suggestions & Flagged Issues layout */}
                {activeReport && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Issues List */}
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                        Flagged SFT Compliance Issues
                      </h3>
                      <div className="space-y-3 custom-scrollbar max-h-60 overflow-y-auto pr-1">
                        {activeReport.issues.map((iss, idx) => (
                          <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide font-bold ${
                                iss.severity === "High" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                iss.severity === "Medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                "bg-slate-800 text-slate-400"
                              }`}>
                                {iss.severity} Severity
                              </span>
                              <span className="text-slate-500 text-[10px] font-mono">
                                {iss.type}
                              </span>
                            </div>
                            <p className="text-slate-300 leading-relaxed font-sans">{iss.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Optimization Suggestions */}
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-400" />
                        AI Synthesis Suggestions
                      </h3>
                      <ul className="space-y-3">
                        {activeReport.suggestions.map((sug, idx) => (
                          <li key={idx} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                            <span className="h-5 w-5 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="mt-0.5">{sug}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* SFT Conversation Inspector List (Editable items) */}
                {currentBatch && (
                  <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl">
                    <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="h-4 w-4 text-green-400" />
                        SFT Dataset Inspect & Inline Editor
                      </h3>
                      <span className="text-xs text-slate-500 font-mono font-semibold">
                        {currentBatch.examples.length} examples inside
                      </span>
                    </div>

                    <div className="space-y-4">
                      {currentBatch.examples.map((ex, exIdx) => (
                        <div key={exIdx} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 relative overflow-hidden group">
                          
                          {/* Quick controls top right */}
                          <div className="absolute top-3 right-3 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEditExample(currentBatch.id, exIdx, ex)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Edit example"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExample(currentBatch.id, exIdx)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 transition"
                              title="Delete item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Render dialog layout of training example */}
                          <div className="space-y-3 max-w-[90%]">
                            {ex.messages.map((m, mIdx) => (
                              <div key={mIdx} className="text-xs leading-relaxed">
                                {/* Role display */}
                                <div className="flex items-center gap-1.5 mb-1">
                                  {m.role === "system" && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                                      System Context
                                    </span>
                                  )}
                                  {m.role === "user" && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                      <User className="h-3 w-3" /> User Prompt
                                    </span>
                                  )}
                                  {m.role === "assistant" && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                                      <Cpu className="h-3 w-3" /> Assistant Target
                                    </span>
                                  )}
                                </div>

                                {/* Content content */}
                                <div className="pl-2 border-l-2 border-slate-800 text-slate-300 font-sans whitespace-pre-line leading-relaxed">
                                  {m.content}
                                </div>

                                {/* Reasoning tag details */}
                                {m.role === "assistant" && m.reasoning && (
                                  <div className="mt-2 ml-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-400 font-mono text-[10px] leading-normal">
                                    <span className="text-slate-500 block font-semibold uppercase tracking-wider mb-1">🧠 Thinking Process Trace:</span>
                                    {m.reasoning}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 4: DATA REGISTRY & FINAL COMPILATION */}
            {activeTab === "registry" && (
              <motion.div
                key="registry-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-6"
              >
                {/* Left side: completed batches lists */}
                <div className="md:col-span-7 bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Database className="h-5 w-5 text-emerald-400" />
                      Dataset Registry
                    </h2>
                    <p className="text-xs text-slate-400">
                      Select approved batches and combine them into a final single dataset. Non-approved pending batches must be audited in Tab 3 first.
                    </p>
                  </div>

                  {/* File Upload Zone for finished JSON/JSONL datasets */}
                  <div className="bg-slate-900/20 border border-dashed border-slate-800/80 p-4.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-blue-500/40 hover:bg-slate-900/30 transition">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                        <Upload className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-semibold text-slate-200">Import External Dataset</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Inject finished JSON or JSONL format records directly</p>
                      </div>
                    </div>
                    
                    <label className="cursor-pointer py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold text-slate-300 transition flex items-center gap-1.5 shrink-0">
                      <FileCode className="h-3.5 w-3.5 text-blue-400" />
                      <span>Upload JSON / JSONL</span>
                      <input 
                        type="file" 
                        accept=".json,.jsonl" 
                        onChange={handleImportDataset} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="space-y-3">
                    {batches.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => b.status === "Approved" && toggleSelectRegistryBatch(b.id)}
                        className={`border rounded-xl p-4 transition-all flex items-center justify-between cursor-pointer ${
                          b.status !== "Approved" 
                            ? "border-slate-800/40 bg-slate-950/20 opacity-60" 
                            : selectedRegistryBatches[b.id]
                              ? "border-green-500 bg-green-500/5 shadow-md shadow-green-500/5"
                              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            {b.status === "Approved" && (
                              <input
                                type="checkbox"
                                checked={!!selectedRegistryBatches[b.id]}
                                onChange={() => {}} // toggled by outer click
                                className="rounded text-green-500 accent-green-500"
                              />
                            )}
                            <h3 className="text-xs font-bold text-slate-100">{b.name}</h3>
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-400">
                            <span className="bg-slate-900/60 px-1.5 py-0.5 rounded">Source: {b.source}</span>
                            <span className="bg-slate-900/60 px-1.5 py-0.5 rounded">Template: {b.templateType}</span>
                            <span className="bg-slate-900/60 px-1.5 py-0.5 rounded font-bold text-slate-300">{b.examplesCount} Examples</span>
                          </div>
                        </div>

                        {/* Status Label */}
                        <div>
                          <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold tracking-wide ${
                            b.status === "Approved" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                            b.status === "Rejected" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {b.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right side: Combined Dataset compile & validation */}
                <div className="md:col-span-5 flex flex-col gap-6">
                  {/* final export card */}
                  <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl flex-1 flex flex-col justify-between">
                    <div>
                      <div className="border-b border-slate-800 pb-4 mb-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <Download className="h-5 w-5 text-green-400" />
                          Compile & Export SFT
                        </h2>
                        <p className="text-xs text-slate-400">
                          We compile your selected batches, partition 10% automatically for validations, and prepare JSONL outputs.
                        </p>
                      </div>

                      {/* Compiler details */}
                      <div className="space-y-4 mb-6 text-xs">
                        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                          <h3 className="font-semibold text-slate-300 mb-2">Selected Dataset Breakdown:</h3>
                          <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
                            <div className="flex justify-between">
                              <span>Included Batches:</span>
                              <span className="text-slate-200">{selectedApprovedBatches.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Selected SFTs:</span>
                              <span className="text-slate-200">{compiledDataset.trainingSet.length + compiledDataset.validationSet.length}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-1.5 text-green-400">
                              <span>➔ Training Set Size:</span>
                              <span className="font-bold">{compiledDataset.trainingSet.length} examples</span>
                            </div>
                            <div className="flex justify-between text-yellow-400">
                              <span>➔ Validation Set Size (10%):</span>
                              <span className="font-bold">{compiledDataset.validationSet.length} examples</span>
                            </div>
                          </div>
                        </div>

                        {/* Validator generator explanation */}
                        <div className="bg-slate-900/40 p-4.5 rounded-xl border border-slate-800/80 leading-relaxed text-[11px] text-slate-300">
                          <span className="font-semibold text-blue-400 block mb-1 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Validator Generator Subset
                          </span>
                          The validator is a dedicated generator that automatically partitions an example set containing approximately <strong className="text-yellow-400 font-bold">10%</strong> of your selected final dataset registry, configured for immediate export in JSON or JSONL.
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-slate-800/80 pt-5">
                      {/* SFT Training Section */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block">1. SFT Training Set ({compiledDataset.trainingSet.length} items)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => downloadJSON(compiledDataset.trainingSet, "sft_training_dataset.json")}
                            disabled={compiledDataset.trainingSet.length === 0}
                            className="py-2 px-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-600/10 hover:from-green-500/20 hover:to-emerald-600/20 border border-green-500/30 text-green-400 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Export JSON</span>
                          </button>
                          <button
                            onClick={() => downloadJSONL(compiledDataset.trainingSet, "sft_training_dataset.jsonl")}
                            disabled={compiledDataset.trainingSet.length === 0}
                            className="py-2 px-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-600/20 hover:from-green-500/30 hover:to-emerald-600/30 border border-green-500/40 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-green-400" />
                            <span>Export JSONL</span>
                          </button>
                        </div>
                      </div>

                      {/* Validator Section */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block">2. Validator Subset (~10% Size: {compiledDataset.validationSet.length} items)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => downloadJSON(compiledDataset.validationSet, "sft_validation_dataset.json")}
                            disabled={compiledDataset.validationSet.length === 0}
                            className="py-2 px-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-600/10 hover:from-yellow-500/20 hover:to-amber-600/20 border border-yellow-500/30 text-yellow-400 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Export JSON</span>
                          </button>
                          <button
                            onClick={() => downloadJSONL(compiledDataset.validationSet, "sft_validation_dataset.jsonl")}
                            disabled={compiledDataset.validationSet.length === 0}
                            className="py-2 px-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-600/20 hover:from-yellow-500/30 hover:to-amber-600/30 border border-yellow-500/40 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-yellow-400" />
                            <span>Export JSONL</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* live preview of exported format */}
                  {exportedPreview && (
                    <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl">
                      <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Code className="h-3.5 w-3.5 text-blue-400" />
                        Compilation Output Preview
                      </h3>
                      <pre className="text-[10px] text-slate-400 font-mono bg-slate-900/60 p-3 rounded-lg overflow-x-auto max-h-48 custom-scrollbar whitespace-pre">
                        {exportedPreview}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 5: DATA EXPERT COMPANION CHATBOT */}
            {activeTab === "expert" && (
              <motion.div
                key="expert-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full"
              >
                {/* Left Area: Chat Console (8/12 cols) */}
                <div className="lg:col-span-8 bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col h-[650px]">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                          TRiAD Core Data Expert
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-semibold uppercase">AI Advisor</span>
                        </h2>
                        <p className="text-[10px] text-slate-400 truncate">SFT theory, custom prompts design, and alignment guidelines.</p>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      <Cpu className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>Gemini 3.5 Flash</span>
                    </div>
                  </div>

                  {/* Messages History Area */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar mb-4">
                    {expertMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role !== "user" && (
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                            Ex
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === "user" 
                            ? "bg-slate-900 border border-slate-800 text-emerald-300 font-mono" 
                            : "bg-slate-900/40 border border-slate-850 text-slate-300"
                        }`}>
                          {/* Parse and render rich custom markdown */}
                          {parseExpertMarkdown(msg.content).map((part, pIdx) => {
                            if (part.type === "code") {
                              return (
                                <div key={pIdx} className="my-3 space-y-1.5">
                                  <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-t border-t border-x border-slate-800">
                                    <span className="text-[10px] font-mono font-bold uppercase text-slate-500">{part.language || "code"}</span>
                                    <CopyCodeButton text={part.content} />
                                  </div>
                                  <pre className="bg-slate-950/80 text-emerald-400 text-[10px] p-3.5 rounded-b border-b border-x border-slate-800 overflow-x-auto font-mono whitespace-pre custom-scrollbar">
                                    {part.content}
                                  </pre>
                                </div>
                              );
                            } else {
                              return (
                                <div key={pIdx}>
                                  <RenderInlineExpertText text={part.content} />
                                </div>
                              );
                            }
                          })}
                          
                          {/* Source Label */}
                          {msg.source && (
                            <div className="mt-2 text-[9px] text-slate-500 font-mono text-right border-t border-slate-850/60 pt-1.5">
                              Source: {msg.source}
                            </div>
                          )}
                        </div>

                        {msg.role === "user" && (
                          <div className="h-7 w-7 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                            Me
                          </div>
                        )}
                      </div>
                    ))}
                    {isExpertSending && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0 select-none animate-pulse">
                          Ex
                        </div>
                        <div className="bg-slate-900/40 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2 select-none">
                          <RefreshCw className="h-3 w-3 animate-spin text-emerald-400 shrink-0" />
                          <span>Consulting SFT training corpus...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendExpertMessage(); }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={expertInput}
                      onChange={(e) => setExpertInput(e.target.value)}
                      placeholder="Ask me anything about SFT, custom system prompts, or TRiAD FTK alignment..."
                      disabled={isExpertSending}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-emerald-400 placeholder:text-slate-500 focus:border-emerald-500 outline-none transition font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isExpertSending || !expertInput.trim()}
                      className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-850 border border-emerald-600 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </div>

                {/* Right Area: Prompt Starters & reference (4/12 cols) */}
                <div className="space-y-6 lg:col-span-4">
                  {/* Quick Topics & Starter Buttons */}
                  <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-300 mb-3.5 flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-emerald-400 shrink-0" />
                      Quick SFT Topics
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleSendExpertMessage("What is the TRiAD Core Foundation?")}
                        className="w-full text-left p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 text-xs text-slate-300 hover:text-white transition flex justify-between items-center group cursor-pointer"
                      >
                        <span className="truncate">🕊️ TRiAD Core Principles (FTK)</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1 font-bold" />
                      </button>

                      <button
                        onClick={() => handleSendExpertMessage("Give me an example SFT JSON structure")}
                        className="w-full text-left p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 text-xs text-slate-300 hover:text-white transition flex justify-between items-center group cursor-pointer"
                      >
                        <span className="truncate">📋 Generate sample SFT JSON example</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1 font-bold" />
                      </button>

                      <button
                        onClick={() => handleSendExpertMessage("How do negative constraints improve performance?")}
                        className="w-full text-left p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 text-xs text-slate-300 hover:text-white transition flex justify-between items-center group cursor-pointer"
                      >
                        <span className="truncate">🚫 Writing Negative Constraints</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1 font-bold" />
                      </button>

                      <button
                        onClick={() => handleSendExpertMessage("Give me 5 tips for great system prompt design")}
                        className="w-full text-left p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 text-xs text-slate-300 hover:text-white transition flex justify-between items-center group cursor-pointer"
                      >
                        <span className="truncate">🧠 System Prompt design tips</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-1 font-bold" />
                      </button>
                    </div>
                  </div>

                  {/* Alignment Principle Card */}
                  <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      What is SFT & TRiAD?
                    </h3>
                    <div className="space-y-3 text-[11px] text-slate-400 leading-relaxed">
                      <p>
                        <strong>Supervised Fine-Tuning (SFT)</strong> takes raw foundation models and trains them on high-fidelity user-assistant dialog pathways to establish custom styles and workflows.
                      </p>
                      <p>
                        <strong>TRiAD (Trust, Alignment & Dignity)</strong> replaces heavy, post-training hardguard rails with embedded, native behaviors built on:
                      </p>
                      <div className="space-y-2 pl-1.5 pt-1 text-[11px]">
                        <div className="flex gap-1.5">
                          <span className="text-emerald-400">🕊️</span>
                          <span><strong>Freedom</strong>: Preserves sovereignty, respects negative choices.</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className="text-emerald-400">🔎</span>
                          <span><strong>Truth</strong>: Clear-headed accuracy, honest admissions of limits.</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className="text-emerald-400">🌸</span>
                          <span><strong>Kindness</strong>: Polite, soft, non-judgmental dialogue interfaces.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* SFT Example Edit Modal */}
      {editingExampleBatchId && editingExampleIndex !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4"
          >
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-green-400" />
                Edit Training Example #{editingExampleIndex + 1}
              </h3>
              <button 
                onClick={() => { setEditingExampleBatchId(null); setEditingExampleIndex(null); }}
                className="text-slate-500 hover:text-slate-300 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {editingMessages.map((msg, idx) => (
                <div key={idx} className="space-y-1.5">
                  <span className={`text-[10px] font-mono font-bold uppercase ${
                    msg.role === "system" ? "text-slate-400" :
                    msg.role === "user" ? "text-blue-400" : "text-green-400"
                  }`}>
                    {msg.role} turn
                  </span>
                  
                  <textarea
                    value={msg.content}
                    rows={3}
                    onChange={(e) => handleUpdateMessageContent(idx, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-green-500 outline-none font-sans leading-relaxed"
                  />

                  {msg.role === "assistant" && msg.reasoning !== undefined && (
                    <div className="space-y-1 mt-1 pl-2 border-l border-slate-800">
                      <span className="text-[9px] text-slate-500 font-mono uppercase block">🧠 Reasoning trace:</span>
                      <textarea
                        value={msg.reasoning}
                        rows={2}
                        onChange={(e) => handleUpdateMessageReasoning(idx, e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-2 text-xs text-slate-400 font-mono outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-end gap-3">
              <button
                onClick={() => { setEditingExampleBatchId(null); setEditingExampleIndex(null); }}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedExample}
                className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-slate-950 text-xs font-bold"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Compact footer */}
      <footer className="border-t border-slate-800 py-6 mt-12 bg-slate-950/40 text-center text-xs text-slate-500">
        <p>SFT Studio Pro &bull; Cloud Run container ingress routing on port 3000 &bull; 2026</p>
      </footer>

      {/* Floating AI Data Expert Companion Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center">
        <button
          id="floating-expert-trigger"
          onClick={() => setActiveTab("expert")}
          title="Open AI Data Expert Companion"
          className="flex items-center gap-2 px-3.5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold border border-emerald-400 shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all duration-200 select-none cursor-pointer"
          style={{ borderRadius: "0px" }}
        >
          <MessageSquare className="h-4.5 w-4.5 shrink-0" />
          <span className="text-xs font-mono font-bold tracking-wide">Expert Chat</span>
        </button>
      </div>
    </div>
  );
}

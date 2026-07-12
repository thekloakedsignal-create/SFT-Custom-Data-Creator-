export enum PresetType {
  GENERAL_USE = "General Use AI",
  COMPANION = "Companion AI",
  PERSONA = "Persona AI",
  RESEARCH = "Research AI",
  CUSTOM = "Custom AI",
}

export enum TemplateType {
  SINGLE_TURN = "Single Turn",
  MULTI_TURN = "Multi Turn",
  REASONING = "Reasoning",
}

export interface SFTMessage {
  role: string;
  content: string;
  reasoning?: string;
}

export interface SFTExample {
  id?: string;
  messages: SFTMessage[];
}

export interface ProjectSettings {
  name: string;
  systemPrompt: string;
  targetTask: string;
  constraints: string;
  selectedPreset: PresetType;
}

export interface SFTBatch {
  id: string;
  name: string;
  source: "Generator" | "Doc Conversion" | "TRiAD Alignment" | "Dataset Import";
  templateType: TemplateType;
  examplesCount: number;
  examples: SFTExample[];
  status: "Pending" | "Approved" | "Rejected";
  timestamp: string;
  description?: string;
  specialInstructions?: string;
  temporaryConstraints?: string;
}

export interface QualityIssue {
  exampleIndex: number;
  severity: "High" | "Medium" | "Low";
  type: string;
  message: string;
}

export interface QualityReport {
  overallScore: number;
  stats: {
    totalExamples: number;
    passedCount: number;
    flaggedCount: number;
  };
  duplicateCheck: {
    duplicatesFound: number;
    duplicatesList: string[];
    deduplicatedLength: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
}

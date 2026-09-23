export type ExtractedItem = {
  description: string;
  marking: string;
  quantity: number | null;
  evidence: string;
  uncertain: boolean;
};
export type Extraction = {
  items: ExtractedItem[];
  warning: string;
  ignoredInstructions: boolean;
  truncated: boolean;
};
export type PhotoCandidate = {
  id: number;
  name: string;
  article: string;
  image: string | null;
  exactMarking: boolean;
};
export type AttachmentResult = Extraction & {
  kind: "photo" | "list";
  candidates: PhotoCandidate[];
  elapsedMs: number;
};

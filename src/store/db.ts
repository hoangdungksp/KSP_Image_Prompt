/**
 * IndexedDB schema for KSP ImagePrompt v0.2
 * - References stored globally as a Library (reusable across projects)
 * - Projects link to references by ID
 * - Shots can store result images
 */

import Dexie, { type Table } from "dexie";
import type { PromptProject, Shot } from "../types";

export type RefCategory = "face" | "outfit" | "product" | "inspiration" | "general";

export interface StoredReferenceImage {
  id: string;
  blob: Blob;
  category: RefCategory;
  tags: string[];
  notes?: string;
  source: "upload" | "pinterest" | "snip" | "url";
  sourceUrl?: string;
  createdAt: number;
  lastUsedAt?: number;
  useCount: number;
  /** Display name set by user */
  name?: string;
}

export interface StoredProject extends PromptProject {
  /** Map of role → reference image ID(s) (link to Library) */
  refImageIds?: {
    /** @deprecated v0.4.2: use faces[] instead. Kept for backward-compat */
    face?: string;
    /** NEW v0.4.2: array of face image IDs (1-6+ allowed) */
    faces?: string[];
    outfit?: string;
    products?: string[];
  };
}

export interface ShotResult {
  id: string;
  shotId: string;
  projectId: string;
  imageBlob: Blob;
  status: "good" | "bad" | "iteration";
  notes?: string;
  promptUsed: string; // snapshot of prompt that generated this
  createdAt: number;
}

class KSPDatabase extends Dexie {
  projects!: Table<StoredProject, string>;
  references!: Table<StoredReferenceImage, string>;
  results!: Table<ShotResult, string>;

  constructor() {
    super("KSPImagePromptDB");

    // v1: projects + references
    this.version(1).stores({
      projects: "id, name, createdAt, updatedAt",
      references: "id, category, createdAt, *tags",
    });

    // v2: add shotResults table + lastUsedAt index
    this.version(2).stores({
      projects: "id, name, createdAt, updatedAt",
      references: "id, category, createdAt, lastUsedAt, *tags",
      results: "id, shotId, projectId, status, createdAt",
    });
  }
}

export const db = new KSPDatabase();

// ============================================================================
// Project helpers
// ============================================================================

export async function saveProject(project: StoredProject): Promise<void> {
  project.updatedAt = Date.now();
  await db.projects.put(project);
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<StoredProject[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
  // Also delete associated results
  const results = await db.results.where("projectId").equals(id).toArray();
  await Promise.all(results.map((r) => db.results.delete(r.id)));
}

// ============================================================================
// Reference Library helpers
// ============================================================================

export async function saveReferenceImage(
  ref: Omit<StoredReferenceImage, "id" | "createdAt" | "useCount">
): Promise<string> {
  const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const full: StoredReferenceImage = {
    ...ref,
    id,
    createdAt: Date.now(),
    useCount: 0,
  };
  await db.references.put(full);
  return id;
}

export async function updateReferenceImage(
  id: string,
  updates: Partial<StoredReferenceImage>
): Promise<void> {
  await db.references.update(id, updates);
}

export async function getReferenceImage(id: string): Promise<StoredReferenceImage | undefined> {
  return db.references.get(id);
}

export async function listReferenceImages(category?: RefCategory): Promise<StoredReferenceImage[]> {
  if (category) {
    return db.references.where("category").equals(category).reverse().sortBy("createdAt");
  }
  return db.references.orderBy("createdAt").reverse().toArray();
}

export async function deleteReferenceImage(id: string): Promise<void> {
  await db.references.delete(id);
}

// v0.6.4: Bulk delete all reference images (optionally filtered by category)
export async function deleteAllReferenceImages(category?: RefCategory): Promise<number> {
  const refs = await listReferenceImages(category);
  const count = refs.length;
  await db.references.bulkDelete(refs.map((r) => r.id));
  return count;
}

export async function incrementRefUseCount(id: string): Promise<void> {
  const ref = await db.references.get(id);
  if (ref) {
    await db.references.update(id, {
      useCount: ref.useCount + 1,
      lastUsedAt: Date.now(),
    });
  }
}

// ============================================================================
// Shot result helpers
// ============================================================================

export async function saveShotResult(
  result: Omit<ShotResult, "id" | "createdAt">
): Promise<string> {
  const id = `result_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.results.put({ ...result, id, createdAt: Date.now() });
  return id;
}

export async function listShotResults(shotId: string): Promise<ShotResult[]> {
  return db.results.where("shotId").equals(shotId).reverse().sortBy("createdAt");
}

export async function deleteShotResult(id: string): Promise<void> {
  await db.results.delete(id);
}

export async function listProjectResults(projectId: string): Promise<ShotResult[]> {
  return db.results.where("projectId").equals(projectId).reverse().sortBy("createdAt");
}

// ============================================================================
// Pinterest import queue (read from chrome.storage.local)
// ============================================================================

interface PendingImport {
  key: string;
  data: string; // base64
  type: string;
  category: RefCategory;
  sourceUrl: string;
  source?: "pinterest" | "snip";
  createdAt: number;
}

export async function processPendingImports(): Promise<number> {
  if (typeof chrome === "undefined" || !chrome.storage) return 0;

  try {
    const result = await chrome.storage.local.get("ksp_pending_imports");
    const queue: PendingImport[] = result.ksp_pending_imports || [];
    if (queue.length === 0) return 0;

    // CRITICAL: Clear queue BEFORE processing, not after.
    // If we clear after, a concurrent caller (e.g., LibraryPicker mounted while
    // Library tab is also open) reads the same queue and processes it again,
    // creating duplicate Dexie entries. Clear first so racing callers find
    // an empty queue and bail out.
    await chrome.storage.local.set({ ksp_pending_imports: [] });

    let imported = 0;
    for (const item of queue) {
      try {
        // Convert base64 → Blob
        const response = await fetch(item.data);
        const blob = await response.blob();

        await saveReferenceImage({
          blob,
          category: item.category,
          tags: [item.source === "snip" ? "snip" : "pinterest"],
          source: (item.source as any) || "pinterest",
          sourceUrl: item.sourceUrl,
        });
        imported++;
      } catch (e) {
        console.error("Failed to process pending import:", e);
      }
    }

    return imported;
  } catch (e) {
    console.error("processPendingImports error:", e);
    return 0;
  }
}

/**
 * Storyboard Versioning v0.7.1
 *
 * Auto-snapshot storyboard state after major actions for revert capability.
 */

export interface StoryboardVersion {
  id: string;
  timestamp: number;
  label: string;
  frames: Array<any>;
  format: string;
  changeDescription?: string;
}

const MAX_VERSIONS = 10; // Keep last 10 versions to limit storage

/**
 * Create a new version snapshot.
 */
export function createVersion(
  frames: any[],
  format: string,
  changeDescription: string,
  existingVersions: StoryboardVersion[] = []
): StoryboardVersion[] {
  const newVersion: StoryboardVersion = {
    id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    label: `v${existingVersions.length + 1}`,
    frames: JSON.parse(JSON.stringify(frames)), // Deep clone
    format,
    changeDescription,
  };

  const updated = [newVersion, ...existingVersions];
  // Trim to MAX_VERSIONS
  return updated.slice(0, MAX_VERSIONS);
}

/**
 * Format relative timestamp for display.
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return new Date(timestamp).toLocaleDateString("vi-VN");
}

/**
 * Get a summary of changes between two versions.
 */
export function compareVersions(
  oldVersion: StoryboardVersion,
  newVersion: StoryboardVersion
): {
  framesAdded: number;
  framesRemoved: number;
  framesEdited: number;
  formatChanged: boolean;
} {
  const oldIds = new Set(oldVersion.frames.map((f) => f.id));
  const newIds = new Set(newVersion.frames.map((f) => f.id));

  let added = 0;
  let removed = 0;
  let edited = 0;

  newVersion.frames.forEach((f) => {
    if (!oldIds.has(f.id)) added++;
  });
  oldVersion.frames.forEach((f) => {
    if (!newIds.has(f.id)) removed++;
  });

  // Count edits in frames present in both
  newVersion.frames.forEach((f) => {
    const oldFrame = oldVersion.frames.find((of) => of.id === f.id);
    if (oldFrame) {
      const oldAction = oldFrame.actionVi || oldFrame.action || "";
      const newAction = f.actionVi || f.action || "";
      if (oldAction !== newAction || oldFrame.role !== f.role) {
        edited++;
      }
    }
  });

  return {
    framesAdded: added,
    framesRemoved: removed,
    framesEdited: edited,
    formatChanged: oldVersion.format !== newVersion.format,
  };
}

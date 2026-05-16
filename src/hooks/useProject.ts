"use client";

import { useCallback, useEffect, useState } from "react";
import { createDefaultProject, inferLanguage } from "@/lib/files/defaultProject";
import type { Project, ProjectFile } from "@/lib/types";

const STORAGE_KEY = "forge-project-v3";
const PERSIST_DEBOUNCE_MS = 500;

export function useProject() {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setProject(JSON.parse(raw) as Project);
          return;
        }
      } catch {
        /* ignore */
      }
      setProject(createDefaultProject());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        /* ignore storage quota/private mode failures */
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [project]);

  const activeFile = project?.files.find((f) => f.name === project.activeFile) ?? project?.files[0];

  const setActiveFile = useCallback((name: string) => {
    setProject((p) => (p ? { ...p, activeFile: name, updatedAt: new Date().toISOString() } : p));
  }, []);

  const updateFileContent = useCallback((name: string, content: string) => {
    setProject((p) => {
      if (!p) return p;
      return {
        ...p,
        updatedAt: new Date().toISOString(),
        files: p.files.map((f) => (f.name === name ? { ...f, content } : f)),
      };
    });
  }, []);

  const upsertFile = useCallback((file: ProjectFile) => {
    setProject((p) => {
      if (!p) return p;
      const exists = p.files.some((f) => f.name === file.name);
      const language = file.language ?? inferLanguage(file.name);
      const nextFile = { ...file, language };
      return {
        ...p,
        activeFile: file.name,
        updatedAt: new Date().toISOString(),
        files: exists
          ? p.files.map((f) => (f.name === file.name ? nextFile : f))
          : [...p.files, nextFile],
      };
    });
  }, []);

  const patchFileContent = useCallback((name: string, updater: (prev: string) => string) => {
    setProject((p) => {
      if (!p) return p;
      return {
        ...p,
        updatedAt: new Date().toISOString(),
        files: p.files.map((f) =>
          f.name === name ? { ...f, content: updater(f.content) } : f
        ),
      };
    });
  }, []);

  const resetProject = useCallback(() => {
    const fresh = createDefaultProject();
    setProject(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  return {
    project,
    activeFile,
    setActiveFile,
    updateFileContent,
    upsertFile,
    patchFileContent,
    resetProject,
  };
}

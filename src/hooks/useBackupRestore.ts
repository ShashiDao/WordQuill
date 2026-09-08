import { useState, useRef } from 'react';
import {
  importDatabaseBackup,
  validateBackupShape,
  type BackupData,
} from '../db/operations';

export interface BackupFeedback {
  type: 'success' | 'error';
  message: string;
}

export function useBackupRestore(onSuccess?: () => Promise<void> | void) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<BackupData | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<BackupFeedback | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setBackupFeedback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!validateBackupShape(parsed)) {
          setBackupFeedback({
            type: 'error',
            message: 'Invalid backup format. File does not contain valid WordQuill progress records.',
          });
          setPendingImportData(null);
          return;
        }

        setPendingImportData(parsed);
      } catch {
        setBackupFeedback({
          type: 'error',
          message: 'Unable to parse JSON file. Ensure you selected a valid WordQuill backup file.',
        });
        setPendingImportData(null);
      }
    };

    reader.onerror = () => {
      setBackupFeedback({
        type: 'error',
        message: 'Failed to read file from disk.',
      });
    };

    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!pendingImportData) return;
    try {
      setIsImporting(true);
      const res = await importDatabaseBackup(pendingImportData);
      setBackupFeedback({
        type: 'success',
        message: `Restored: ${res.wordsCount} words, ${res.progressCount} daily logs, ${res.settingsCount} settings.`,
      });
      setPendingImportData(null);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      console.error(err);
      setBackupFeedback({
        type: 'error',
        message: 'Error importing backup into local database.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const cancelImport = () => {
    setPendingImportData(null);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    isImporting,
    pendingImportData,
    backupFeedback,
    setBackupFeedback,
    handleFileSelect,
    confirmImport,
    cancelImport,
    openFilePicker,
  };
}

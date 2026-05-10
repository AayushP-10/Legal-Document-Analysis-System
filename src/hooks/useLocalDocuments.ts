// Hook to subscribe to the local document store.
// Components using this hook will re-render when documents are added/removed.

import { useSyncExternalStore } from "react";
import {
  subscribeDocuments,
  getDocumentsSnapshot,
  type LocalDocument,
} from "@/stores/localDocumentStore";

export function useLocalDocuments(): LocalDocument[] {
  return useSyncExternalStore(subscribeDocuments, getDocumentsSnapshot);
}

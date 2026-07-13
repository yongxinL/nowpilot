import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TransactionType, TransactionStatus, Severity, AITransaction, TraceTree } from '../telemetry/types';
import { aiTransactionLogDB } from '../storage/stores/AITransactionLogDB';

export interface DiagnosticsState {
  // Filter state (D-13)
  filterType: TransactionType | undefined;
  filterStatus: TransactionStatus | undefined;
  filterProvider: string | undefined;
  filterSeverity: Severity | undefined;
  filterDateRange: [number, number] | undefined;
  searchQuery: string;
  // Selection
  selectedOperationId: string | undefined;
  // Modes (D-38, D-39)
  diagnosticMode: boolean;
  privacyMode: boolean;
  // Data
  transactions: AITransaction[];
  traceTree: TraceTree | undefined;
  loading: boolean;
  // Actions
  setFilter: (key: string, value: unknown) => void;
  selectTransaction: (operationId: string) => Promise<void>;
  setDiagnosticMode: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  refreshTransactions: () => Promise<void>;
  clearFilters: () => void;
}

const chromeLocalStorage = createJSONStorage<DiagnosticsState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useDiagnosticsStore = create<DiagnosticsState>()(
  persist(
    (set) => ({
      // Filter state defaults
      filterType: undefined,
      filterStatus: undefined,
      filterProvider: undefined,
      filterSeverity: undefined,
      filterDateRange: undefined,
      searchQuery: '',
      // Selection
      selectedOperationId: undefined,
      // Mode defaults
      diagnosticMode: false,
      privacyMode: false,
      // Data defaults
      transactions: [],
      traceTree: undefined,
      loading: false,

      // Set a single filter field by key
      setFilter: (key: string, value: unknown) => set({ [key]: value } as Partial<DiagnosticsState>),

      // Select a transaction and load its trace tree
      selectTransaction: async (operationId: string) => {
        set({ selectedOperationId: operationId, loading: true });
        try {
          const traceTree = await aiTransactionLogDB.getTraceTree(operationId);
          set({ traceTree, loading: false });
        } catch {
          set({ traceTree: undefined, loading: false });
        }
      },

      // Toggle diagnostic mode (persisted)
      setDiagnosticMode: (enabled: boolean) => set({ diagnosticMode: enabled }),

      // Toggle privacy mode (persisted)
      setPrivacyMode: (enabled: boolean) => set({ privacyMode: enabled }),

      // Refresh transaction list from AITransactionLogDB using current filter state
      refreshTransactions: async () => {
        set({ loading: true });
        try {
          const state = useDiagnosticsStore.getState();
          const transactions = await aiTransactionLogDB.queryTransactions({
            types: state.filterType ? [state.filterType] : undefined,
            statuses: state.filterStatus ? [state.filterStatus] : undefined,
            providers: state.filterProvider ? [state.filterProvider] : undefined,
            severities: state.filterSeverity ? [state.filterSeverity] : undefined,
            dateRange: state.filterDateRange,
            searchQuery: state.searchQuery || undefined,
          });
          set({ transactions, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      // Reset all filter and selection state
      clearFilters: () => set({
        filterType: undefined,
        filterStatus: undefined,
        filterProvider: undefined,
        filterSeverity: undefined,
        filterDateRange: undefined,
        searchQuery: '',
        selectedOperationId: undefined,
        traceTree: undefined,
      }),
    }),
    {
      name: 'np_diagnostics',
      storage: chromeLocalStorage,
      // Only persist mode toggles, not filter/search/selection state (UI-ephemeral)
      partialize: (state) => ({
        diagnosticMode: state.diagnosticMode,
        privacyMode: state.privacyMode,
      }),
    },
  ),
);

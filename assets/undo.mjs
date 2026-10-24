// Both pages use the same durable transaction journal. There is no separate
// in-memory undo stack: data and Undo/Redo branch flags are persisted in one atomic write.
export { persistentUndo as undoManager, createDataStore } from './data.mjs?v=task-entry-9';

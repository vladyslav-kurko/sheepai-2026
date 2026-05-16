export interface CivicState {
    clarificationCount: number;
    slots: Record<string, string>;
    intent: string | null;
    city: string | null;
}

export interface ChipAnswer {
    label: string;
    slotKey: string;
    slotValue: string;
}

export function createCivicState(): CivicState {
    return { clarificationCount: 0, slots: {}, intent: null, city: null };
}

export function mergeChipAnswer(state: CivicState, chip: ChipAnswer): CivicState {
    const updated: CivicState = { ...state, slots: { ...state.slots } };
    if (chip.slotKey === "__intent__") {
        updated.intent = chip.slotValue;
    } else if (chip.slotKey === "city") {
        updated.city = chip.slotValue;
    } else {
        updated.slots[chip.slotKey] = chip.slotValue;
    }
    return updated;
}

export function recordClarification(state: CivicState): CivicState {
    return { ...state, clarificationCount: state.clarificationCount + 1 };
}

export function buildContextNote(state: CivicState, forceAnswer: boolean): string {
    const parts: string[] = [];
    if (state.intent) parts.push(`intent: ${state.intent}`);
    if (state.city) parts.push(`city: ${state.city}`);
    const slotEntries = Object.entries(state.slots);
    if (slotEntries.length > 0) {
        parts.push(`known slots: ${slotEntries.map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }

    const contextLine = parts.length > 0
        ? `[Conversation context: ${parts.join("; ")}]\n`
        : "";

    const forceLine = forceAnswer
        ? `[The user has already been asked for clarification ${state.clarificationCount} time(s). Do NOT return a clarification response — give the best answer you can with available context.]\n`
        : "";

    return contextLine + forceLine;
}

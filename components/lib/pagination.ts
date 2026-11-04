"use client";

import { useReducer } from "react";

type PageState = { cursors: (string | null)[]; index: number };
type PageAction = { type: "next"; cursor: string } | { type: "previous" };

export function pageReducer(state: PageState, action: PageAction): PageState {
  if (action.type === "previous")
    return { ...state, index: Math.max(0, state.index - 1) };
  if (state.cursors[state.index] === action.cursor) return state;
  return {
    cursors: [...state.cursors.slice(0, state.index + 1), action.cursor],
    index: state.index + 1,
  };
}

export function usePageCursor() {
  const [state, dispatch] = useReducer(pageReducer, {
    cursors: [null],
    index: 0,
  });
  return {
    cursor: state.cursors[state.index],
    page: state.index + 1,
    previous: () => dispatch({ type: "previous" }),
    next: (cursor: string) => dispatch({ type: "next", cursor }),
  };
}

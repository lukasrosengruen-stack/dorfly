import { create } from 'zustand'

interface LoginWallState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useLoginWallStore = create<LoginWallState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))

import { createContext, useContext, useState } from 'react'

export type QuizState = {
  currentQuestion: string | null
  studentAnswer: string
  isCorrect: boolean | null
}

const defaultState: QuizState = { currentQuestion: null, studentAnswer: '', isCorrect: null }

const QuizContext = createContext<{
  quizState: QuizState
  setQuizState: (s: QuizState) => void
}>({ quizState: defaultState, setQuizState: () => {} })

export function QuizContextProvider({ children }: { children: React.ReactNode }) {
  const [quizState, setQuizState] = useState<QuizState>(defaultState)
  return <QuizContext.Provider value={{ quizState, setQuizState }}>{children}</QuizContext.Provider>
}

export function useQuizContext() {
  return useContext(QuizContext)
}

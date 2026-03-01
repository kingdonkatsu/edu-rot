import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  WeeklyLearningState,
  WeeklyInsightsAgentOutput,
  ErrorClassification,
  MasteryLevel,
} from '../types.js';
import { postCrashCourse, postWeeklyInsights } from './agents-api.js';
import type { AgentsApiOptions } from './agents-api.js';

// Minimal shape of a topic card as it comes from the feed
export interface TopicCard {
  topic: string;
  subtopic: string;
  concept_tag: string;
}

// Minimal student context needed to build a crash course request
export interface StudentContext {
  student_id: string;
  error_classification: ErrorClassification;
  mastery_level: MasteryLevel;
  known_strengths: string[];
  rag: CrashCourseAgentInput['rag'];
}

export interface FrontendAgentFlows {
  onTopicCardTap(
    card: TopicCard,
    student: StudentContext,
    opts: AgentsApiOptions
  ): Promise<CrashCourseAgentOutput>;

  fetchWeeklyRecap(
    state: WeeklyLearningState,
    opts: AgentsApiOptions
  ): Promise<WeeklyInsightsAgentOutput>;
}

export function createFrontendAgentFlows(): FrontendAgentFlows {
  return {
    async onTopicCardTap(card, student, opts) {
      const input: CrashCourseAgentInput = {
        student_id: student.student_id,
        topic: card.topic,
        subtopic: card.subtopic,
        error_classification: student.error_classification,
        mastery_level: student.mastery_level,
        known_strengths: student.known_strengths,
        rag: student.rag,
      };
      return postCrashCourse(input, opts);
    },

    async fetchWeeklyRecap(state, opts) {
      return postWeeklyInsights(state, opts);
    },
  };
}

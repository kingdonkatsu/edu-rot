import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  WeeklyInsightsAgentOutput,
  WeeklyLearningState,
} from '../types.js';
import {
  postCrashCourseAgent,
  postWeeklyInsightsAgent,
  type AgentApiRequestOptions,
} from './agents-api.js';

export interface TopicCardSelection {
  topic: string;
  subtopic: string;
}

export type CrashCourseStudentContext = Omit<CrashCourseAgentInput, 'topic' | 'subtopic'>;

export interface FrontendAgentFlows {
  onTopicCardTap: (
    topicCard: TopicCardSelection,
    studentContext: CrashCourseStudentContext,
    options?: AgentApiRequestOptions
  ) => Promise<CrashCourseAgentOutput>;
  fetchWeeklyRecap: (
    weeklyLearningState: WeeklyLearningState,
    options?: AgentApiRequestOptions
  ) => Promise<WeeklyInsightsAgentOutput>;
}

export interface FrontendAgentFlowDeps {
  postCrashCourse?: (
    input: CrashCourseAgentInput,
    options?: AgentApiRequestOptions
  ) => Promise<CrashCourseAgentOutput>;
  postWeeklyInsights?: (
    input: WeeklyLearningState,
    options?: AgentApiRequestOptions
  ) => Promise<WeeklyInsightsAgentOutput>;
}

export function createFrontendAgentFlows(
  deps: FrontendAgentFlowDeps = {}
): FrontendAgentFlows {
  const crashCoursePoster = deps.postCrashCourse ?? postCrashCourseAgent;
  const weeklyInsightsPoster = deps.postWeeklyInsights ?? postWeeklyInsightsAgent;

  return {
    async onTopicCardTap(
      topicCard: TopicCardSelection,
      studentContext: CrashCourseStudentContext,
      options: AgentApiRequestOptions = {}
    ): Promise<CrashCourseAgentOutput> {
      return crashCoursePoster(
        {
          ...studentContext,
          topic: topicCard.topic,
          subtopic: topicCard.subtopic,
        },
        options
      );
    },

    async fetchWeeklyRecap(
      weeklyLearningState: WeeklyLearningState,
      options: AgentApiRequestOptions = {}
    ): Promise<WeeklyInsightsAgentOutput> {
      return weeklyInsightsPoster(weeklyLearningState, options);
    },
  };
}

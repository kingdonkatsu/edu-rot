import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  CrashCourseVideoPreference,
  CrashCourseVideoRenderResponse,
  WeeklyInsightsAgentOutput,
  WeeklyLearningState,
} from '../types.js';
import {
  postCrashCourseAgent,
  postCrashCourseVideoRender,
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
  generateCrashCourseVideo: (
    topicCard: TopicCardSelection,
    studentContext: CrashCourseStudentContext,
    preference?: CrashCourseVideoPreference,
    options?: AgentApiRequestOptions
  ) => Promise<CrashCourseVideoRenderResponse>;
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
  postCrashCourseVideo?: (
    input: {
      crash_course_input: CrashCourseAgentInput;
      video_preference?: CrashCourseVideoPreference;
      auto_poll?: boolean;
      poll_interval_ms?: number;
      max_wait_ms?: number;
    },
    options?: AgentApiRequestOptions
  ) => Promise<CrashCourseVideoRenderResponse>;
}

export function createFrontendAgentFlows(
  deps: FrontendAgentFlowDeps = {}
): FrontendAgentFlows {
  const crashCoursePoster = deps.postCrashCourse ?? postCrashCourseAgent;
  const weeklyInsightsPoster = deps.postWeeklyInsights ?? postWeeklyInsightsAgent;
  const crashCourseVideoPoster = deps.postCrashCourseVideo ?? postCrashCourseVideoRender;

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

    async generateCrashCourseVideo(
      topicCard: TopicCardSelection,
      studentContext: CrashCourseStudentContext,
      preference: CrashCourseVideoPreference = {},
      options: AgentApiRequestOptions = {}
    ): Promise<CrashCourseVideoRenderResponse> {
      return crashCourseVideoPoster(
        {
          crash_course_input: {
            ...studentContext,
            topic: topicCard.topic,
            subtopic: topicCard.subtopic,
          },
          video_preference: preference,
          auto_poll: true,
          poll_interval_ms: 2500,
          max_wait_ms: 120000,
        },
        options
      );
    },
  };
}

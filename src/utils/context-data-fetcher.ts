import { getBackendSrv, config } from '@grafana/runtime';
import { getRecommenderServiceUrl } from '../constants';
import { fetchLearningJourneyContent, Milestone, getLearningJourneyCompletionPercentage } from './docs-fetcher';

// Interfaces extracted from context-panel.tsx
export interface DataSource {
  id: number;
  name: string;
  type: string;
  url?: string;
  isDefault?: boolean;
  access?: string;
}

export interface User {
  id: number;
  uid: string;
  email: string;
  name: string;
  login: string;
  isGrafanaAdmin: boolean;
  theme: string;
  orgId: number;
  isDisabled: boolean;
  isExternal: boolean;
  isExternallySynced: boolean;
  isGrafanaAdminExternallySynced: boolean;
  authLabels: string[];
  updatedAt: string;
  createdAt: string;
  avatarUrl: string;
  isProvisioned: boolean;
}

export interface DashboardInfo {
  id?: number;
  title?: string;
  uid?: string;
  tags?: string[];
  folderId?: number;
  folderTitle?: string;
}

export interface Recommendation {
  title: string;
  url: string;
  type?: string; // 'learning-journey' or 'docs-page'
  matchAccuracy?: number; // Scale of 0 to 1, where 1 = 100% accurate match
  milestones?: Milestone[];
  totalSteps?: number;
  isLoadingSteps?: boolean;
  stepsExpanded?: boolean;
  summary?: string; // Journey summary from first 3 paragraphs
  summaryExpanded?: boolean; // Track summary expansion state
  completionPercentage?: number; // 0-100 based on browser cache progress for learning journeys
  [key: string]: any; // Allow for additional attributes from the server
}

export interface RecommenderResponse {
  recommendations: Recommendation[];
}

export interface ContextPayload {
  path: string;
  datasources: string[];
  tags: string[];
  user_id: string;
  user_role: string;
  platform: string;
}

// Data fetching functions extracted from context panel
export async function fetchDataSources(): Promise<DataSource[]> {
  try {
    const dataSources = await getBackendSrv().get('/api/datasources');
    return dataSources || [];
  } catch (error) {
    console.warn('Failed to fetch data sources:', error);
    return [];
  }
}

export async function fetchUser(): Promise<User | null> {
  try {
    const user = await getBackendSrv().get('/api/user');
    return user; 
  } catch (error) {
    console.warn('Failed to fetch user:', error);
    return null;
  }
}

export async function fetchDashboardInfo(currentPath: string): Promise<DashboardInfo | null> {
  try {
    // Check if we're on a dashboard page
    const pathMatch = currentPath.match(/\/d\/([^\/]+)/);
    if (pathMatch) {
      const dashboardUid = pathMatch[1];
      const dashboardInfo = await getBackendSrv().get(`/api/dashboards/uid/${dashboardUid}`);
      return {
        id: dashboardInfo.dashboard?.id,
        title: dashboardInfo.dashboard?.title,
        uid: dashboardInfo.dashboard?.uid,
        tags: dashboardInfo.dashboard?.tags,
        folderId: dashboardInfo.meta?.folderId,
        folderTitle: dashboardInfo.meta?.folderTitle,
      };
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch dashboard info:', error);
    return null;
  }
}

export function fetchGrafanaVersion(): string {
  try {
    // Use runtime config instead of API endpoint for Grafana Cloud compatibility
    return config.bootData.settings.buildInfo.version || 'Unknown';
  } catch (error) {
    console.warn('Failed to fetch Grafana version from runtime config:', error);
    return 'Unknown';
  }
}

/**
 * Filter out unhelpful recommendations that point to generic landing pages
 */
function filterUsefulRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter(recommendation => {
    const url = recommendation.url;
    
    // Remove generic learning journeys landing page (no specific journey)
    if (url === 'https://grafana.com/docs/learning-journeys' || 
        url === 'https://grafana.com/docs/learning-journeys/') {
      return false;
    }
    
    // Remove URLs that are just the base with query parameters but no journey path
    if (url.match(/^https:\/\/grafana\.com\/docs\/learning-journeys\/?\?/)) {
      return false;
    }
    
    // Keep recommendations that point to specific learning journeys or docs pages
    return true;
  });
}

/**
 * Sort recommendations by type and match accuracy
 * Learning journeys always come first, then docs pages
 * Within each type, sort by matchAccuracy (highest first)
 */
function sortRecommendationsByAccuracy(recommendations: Recommendation[]): Recommendation[] {
  // Separate learning journeys from docs pages
  const learningJourneys = recommendations.filter(rec => 
    rec.type === 'learning-journey' || !rec.type // Default to learning-journey if no type
  );
  const docsPages = recommendations.filter(rec => 
    rec.type === 'docs-page'
  );
  
  // Sort by matchAccuracy (highest first), treating undefined as 0
  const sortByAccuracy = (a: Recommendation, b: Recommendation) => {
    const accuracyA = a.matchAccuracy ?? 0;
    const accuracyB = b.matchAccuracy ?? 0;
    return accuracyB - accuracyA; // Descending order (highest first)
  };
  
  // Sort each group by accuracy
  const sortedLearningJourneys = learningJourneys.sort(sortByAccuracy);
  const sortedDocsPages = docsPages.sort(sortByAccuracy);
  
  // Return learning journeys first, then docs pages
  return [...sortedLearningJourneys, ...sortedDocsPages];
}

export async function fetchRecommendations(
  currentPath: string,
  dataSources: DataSource[],
  contextTags: string[]
): Promise<{ 
  recommendations: Recommendation[];
  error: string | null;
}> {
  try {
    // Validate that we have a path
    if (!currentPath) {
      console.error('fetchRecommendations called with empty path');
      return {
        recommendations: [],
        error: 'No path provided for recommendations',
      };
    }

    // Prepare the payload for the recommender service
    const payload: ContextPayload = {
      path: currentPath,
      datasources: dataSources.map(ds => ds.name),
      tags: contextTags,
      user_id: config.bootData.user.analytics.identifier,
      user_role: config.bootData.user.orgRole || 'Viewer',
      platform: config.bootData.settings.buildInfo.versionString.startsWith('Grafana Cloud') ? 'cloud' : 'oss',
    };

    // Send request to your recommender service
    const response = await fetch(`${getRecommenderServiceUrl()}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: RecommenderResponse = await response.json();
    const defaultR0: Recommendation = {
      title: 'Build Your First Dashboard',
      url: 'https://raw.githubusercontent.com/moxious/dynamics-test/refs/heads/main/r-grafana',
      type: 'docs-page',
      summary: 'Dynamic walk-through of building a dashboard.',
    };
    const defaultR: Recommendation = {
      title: 'Product Interactive Tutorial Demo',
      // This will have /unstyled.html added to it.
      url: 'https://raw.githubusercontent.com/moxious/dynamics-test/refs/heads/main/prometheus-datasource',
      type: 'docs-page',
      summary: 'A test of interactive elements.',
    };
    const defaultR2: Recommendation = {
      title: 'Tutorial Environment Demo',
      url: 'https://raw.githubusercontent.com/Jayclifford345/tutorial-environment/refs/heads/master/',
      type: 'docs-page',
      summary: 'Additional tutorial environment for testing interactive elements.',
    };
    const recommendations = data.recommendations || [];
    recommendations.push(defaultR0);
    recommendations.push(defaultR);
    recommendations.push(defaultR2);
    
    // Only fetch step counts for learning journey recommendations
    const processedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        // Only fetch milestone data for learning journeys
        if (recommendation.type === 'learning-journey' || !recommendation.type) {
          try {
            const journeyContent = await fetchLearningJourneyContent(recommendation.url);
            const completionPercentage = getLearningJourneyCompletionPercentage(recommendation.url);
            
            return {
              ...recommendation,
              totalSteps: journeyContent?.milestones?.length || 0,
              milestones: journeyContent?.milestones || [],
              summary: journeyContent?.summary || '',
              completionPercentage: completionPercentage,
            };
          } catch (error) {
            console.warn(`Failed to fetch steps for learning journey ${recommendation.title}:`, error);
            const completionPercentage = getLearningJourneyCompletionPercentage(recommendation.url);
            
            return {
              ...recommendation,
              totalSteps: 0,
              milestones: [],
              summary: '',
              completionPercentage: completionPercentage,
            };
          }
        } else {
          // For docs pages, don't fetch milestone data or completion percentage
          return {
            ...recommendation,
            totalSteps: 0, // Docs pages don't have steps
            milestones: [],
            summary: '',
            completionPercentage: undefined, // Docs pages don't have completion
          };
        }
      })
    );
    
    // Filter out unhelpful recommendations
    const filteredRecommendations = filterUsefulRecommendations(processedRecommendations);
    
    // Sort recommendations by type and matchAccuracy
    // Learning journeys always come first, then docs pages
    // Within each type, sort by matchAccuracy (highest first)
    const sortedRecommendations = sortRecommendationsByAccuracy(filteredRecommendations);
    
    return {
      recommendations: sortedRecommendations,
      error: null,
    };
  } catch (error) {
    console.warn('Failed to fetch recommendations:', error);
    return {
      recommendations: [],
      error: error instanceof Error ? error.message : 'Failed to fetch recommendations',
    };
  }
} 

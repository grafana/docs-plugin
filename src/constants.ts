import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

// Default configuration values
export const DEFAULT_RECOMMENDER_SERVICE_URL = 'https://grafana-recommender-93209135917.us-central1.run.app';
export const DEFAULT_DOCS_BASE_URL = 'https://grafana.com';
export const DEFAULT_DOCS_USERNAME = '';
export const DEFAULT_DOCS_PASSWORD = '';
export const DEFAULT_TUTORIAL_URL = '';

// Configuration interface
export interface DocsPluginConfig {
  recommenderServiceUrl?: string;
  docsBaseUrl?: string;
  docsUsername?: string;
  docsPassword?: string;
  tutorialUrl?: string;
}

// Global configuration - will be set by the plugin initialization
let pluginConfig: DocsPluginConfig = {};

// Configuration service
export const ConfigService = {
  setConfig: (config: DocsPluginConfig) => {
    pluginConfig = config;
  },
  
  getConfig: (): DocsPluginConfig => ({
    recommenderServiceUrl: pluginConfig.recommenderServiceUrl || DEFAULT_RECOMMENDER_SERVICE_URL,
    docsBaseUrl: pluginConfig.docsBaseUrl || DEFAULT_DOCS_BASE_URL,
    docsUsername: pluginConfig.docsUsername || DEFAULT_DOCS_USERNAME,
    docsPassword: pluginConfig.docsPassword || DEFAULT_DOCS_PASSWORD,
    tutorialUrl: pluginConfig.tutorialUrl || DEFAULT_TUTORIAL_URL,
  }),
};

// Export configuration values (with getters for dynamic access)
export const getRecommenderServiceUrl = () => ConfigService.getConfig().recommenderServiceUrl;
export const getDocsBaseUrl = () => ConfigService.getConfig().docsBaseUrl;
export const getDocsUsername = () => ConfigService.getConfig().docsUsername;
export const getDocsPassword = () => ConfigService.getConfig().docsPassword;
export const getTutorialUrl = () => ConfigService.getConfig().tutorialUrl;

// Legacy exports for backward compatibility
export const RECOMMENDER_SERVICE_URL = DEFAULT_RECOMMENDER_SERVICE_URL;
export const DOCS_BASE_URL = DEFAULT_DOCS_BASE_URL;
export const DOCS_USERNAME = DEFAULT_DOCS_USERNAME;
export const DOCS_PASSWORD = DEFAULT_DOCS_PASSWORD;

export enum ROUTES {
  Context = '',
}

/**
 * Pure requirements checking utilities
 * Extracted from interactive.hook.ts to eliminate mock element anti-pattern
 * 
 * This module handles requirements checking without DOM manipulation,
 * focusing on API calls, configuration checks, and Grafana state validation.
 */

import { locationService, config, hasPermission, getDataSourceSrv } from '@grafana/runtime';
import { ContextService } from './context';

// Re-export types for convenience
export interface RequirementsCheckResult {
  requirements: string;
  pass: boolean;
  error: CheckResultError[];
}

export interface CheckResultError {
  requirement: string;
  pass: boolean;
  error?: string;
  context?: any;
}

export interface RequirementsCheckOptions {
  requirements: string;
  targetAction?: string;
  refTarget?: string;
  targetValue?: string;
  stepId?: string;
}

/**
 * DOM-dependent check functions interface
 * These functions need to be passed in from the interactive hook
 * since they require DOM access and interactive logic
 */
export interface DOMCheckFunctions {
  reftargetExistsCHECK: (reftarget: string, targetAction: string) => Promise<CheckResultError>;
  navmenuOpenCHECK: () => Promise<CheckResultError>;
}

/**
 * Core requirements checking function (pure implementation)
 * Replaces the mock element anti-pattern with direct string-based checking
 */
export async function checkRequirements(
  options: RequirementsCheckOptions,
  domCheckFunctions?: DOMCheckFunctions
): Promise<RequirementsCheckResult> {
  const { requirements, targetAction = 'button', refTarget = '' } = options;
  
  if (!requirements) {
    return {
      requirements: requirements || '',
      pass: true,
      error: []
    };
  }

  const checks: string[] = requirements.split(',').map(check => check.trim());

  /**
   * Perform individual requirement check
   * Routes to appropriate check function based on requirement type
   */
  async function performCheck(check: string): Promise<CheckResultError> {
    // DOM-dependent checks (delegate to provided functions)
    if (check === 'exists-reftarget') {
      if (!domCheckFunctions?.reftargetExistsCHECK) {
        return {
          requirement: check,
          pass: false,
          error: 'DOM check function not available'
        };
      }
      return domCheckFunctions.reftargetExistsCHECK(refTarget, targetAction);
    }
    
    if (check === 'navmenu-open') {
      if (!domCheckFunctions?.navmenuOpenCHECK) {
        return {
          requirement: check,
          pass: false,
          error: 'DOM check function not available'
        };
      }
      return domCheckFunctions.navmenuOpenCHECK();
    }

    // Pure requirement checks (no DOM access needed)
    if (check === 'has-datasources') {
      return hasDatasourcesCHECK(check);
    }
    
    if (check === 'is-admin') {
      return isAdminCHECK(check);
    }

    // Enhanced permission-based checks
    if (check.startsWith('has-permission:')) {
      return hasPermissionCHECK(check);
    }
    
    if (check.startsWith('has-role:')) {
      return hasRoleCHECK(check);
    }

    // Data source and plugin checks
    if (check.startsWith('has-datasource:')) {
      return hasDataSourceCHECK(check);
    }
    
    if (check.startsWith('has-plugin:')) {
      return hasPluginCHECK(check);
    }
    
    if (check.startsWith('has-dashboard-named:')) {
      return hasDashboardNamedCHECK(check);
    }

    // Location and navigation checks
    if (check.startsWith('on-page:')) {
      return onPageCHECK(check);
    }

    // Feature and environment checks
    if (check.startsWith('has-feature:')) {
      return hasFeatureCHECK(check);
    }
    
    if (check.startsWith('in-environment:')) {
      return inEnvironmentCHECK(check);
    }
    
    if (check.startsWith('min-version:')) {
      return minVersionCHECK(check);
    }

    // Unknown requirement
    console.warn("Unknown requirement:", check);
    return {
      requirement: check,
      pass: true,
      error: "Unknown requirement"
    };
  }

  const results = await Promise.all(checks.map(check => performCheck(check)));

  return {
    requirements,
    pass: results.every(result => result.pass),
    error: results
  };
}

/**
 * ============================================================================
 * PURE REQUIREMENTS CHECKING FUNCTIONS
 * These functions only use APIs, configuration, and Grafana state - no DOM
 * ============================================================================
 */

// Enhanced permission checking using Grafana's permission system
async function hasPermissionCHECK(check: string): Promise<CheckResultError> {
  try {
    const permission = check.replace('has-permission:', '');
    const hasAccess = hasPermission(permission);
    
    return {
      requirement: check,
      pass: hasAccess,
      error: hasAccess ? undefined : `Missing permission: ${permission}`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Permission check failed: ${error}`
    };
  }
}

// Enhanced user role checking using config.bootData.user
async function hasRoleCHECK(check: string): Promise<CheckResultError> {
  try {
    const user = config.bootData?.user;
    if (!user) {
      return {
        requirement: check,
        pass: false,
        error: "User information not available"
      };
    }

    const requiredRole = check.replace('has-role:', '').toLowerCase();
    let hasRole = false;
    
    switch (requiredRole) {
      case 'admin':
      case 'grafana-admin':
        hasRole = user.isGrafanaAdmin || false;
        break;
      case 'editor':
        hasRole = user.orgRole === 'Editor' || user.orgRole === 'Admin' || user.isGrafanaAdmin || false;
        break;
      case 'viewer':
        hasRole = !!user.orgRole;
        break;
      default:
        hasRole = user.orgRole === requiredRole;
    }
    
    return {
      requirement: check,
      pass: hasRole,
      error: hasRole ? undefined : `User role '${user.orgRole || 'none'}' does not meet requirement '${requiredRole}'`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Role check failed: ${error}`
    };
  }
}

// Enhanced data source checking using DataSourceSrv
async function hasDataSourceCHECK(check: string): Promise<CheckResultError> {
  try {
    const dataSourceSrv = getDataSourceSrv();
    const dsRequirement = check.replace('has-datasource:', '').toLowerCase();
    
    const dataSources = dataSourceSrv.getList();
    let found = false;
    
    found = dataSources.some(ds => 
        ds.name.toLowerCase() === dsRequirement || 
        ds.uid.toLowerCase() === dsRequirement ||
        ds.type.toLowerCase() === dsRequirement
    );
    
    return {
      requirement: check,
      pass: found,
      error: found ? undefined : `No data source found with name/uid/type: ${dsRequirement}`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Data source check failed: ${error}`
    };
  }
}

// Plugin availability checking using /api/plugins endpoint
async function hasPluginCHECK(check: string): Promise<CheckResultError> {
  try {
    const pluginId = check.replace('has-plugin:', '');
    const plugins = await ContextService.fetchPlugins();
    const pluginExists = plugins.some(plugin => plugin.id === pluginId);
    
    return {
      requirement: check,
      pass: pluginExists,
      error: pluginExists ? undefined : `Plugin '${pluginId}' is not installed or enabled`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Plugin check failed: ${error}`
    };
  }
}

// Dashboard availability checking using /api/search endpoint
async function hasDashboardNamedCHECK(check: string): Promise<CheckResultError> {
  try {
    const dashboardName = check.replace('has-dashboard-named:', '');
    const dashboards = await ContextService.fetchDashboardsByName(dashboardName);
    const dashboardExists = dashboards.some(dashboard => 
      dashboard.title.toLowerCase() === dashboardName.toLowerCase()
    );
    
    return {
      requirement: check,
      pass: dashboardExists,
      error: dashboardExists ? undefined : `Dashboard named '${dashboardName}' not found`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Dashboard check failed: ${error}`
    };
  }
}

// Location/URL checking using locationService
async function onPageCHECK(check: string): Promise<CheckResultError> {
  try {
    const location = locationService.getLocation();
    const requiredPath = check.replace('on-page:', '');
    const currentPath = location.pathname;
    const matches = currentPath.includes(requiredPath) || currentPath === requiredPath;
    
    return {
      requirement: check,
      pass: matches,
      error: matches ? undefined : `Current page '${currentPath}' does not match required path '${requiredPath}'`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Page check failed: ${error}`
    };
  }
}

// Feature toggle checking
async function hasFeatureCHECK(check: string): Promise<CheckResultError> {
  try {
    const featureName = check.replace('has-feature:', '');
    const featureToggles = config.featureToggles as Record<string, boolean> | undefined;
    const isEnabled = featureToggles && featureToggles[featureName];
    
    return {
      requirement: check,
      pass: !!isEnabled,
      error: isEnabled ? undefined : `Feature toggle '${featureName}' is not enabled`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Feature check failed: ${error}`
    };
  }
}

// Environment checking
async function inEnvironmentCHECK(check: string): Promise<CheckResultError> {
  try {
    const requiredEnv = check.replace('in-environment:', '').toLowerCase();
    const currentEnv = config.buildInfo?.env?.toLowerCase() || 'unknown';
    
    return {
      requirement: check,
      pass: currentEnv === requiredEnv,
      error: currentEnv === requiredEnv ? undefined : `Current environment '${currentEnv}' does not match required '${requiredEnv}'`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Environment check failed: ${error}`
    };
  }
}

// Version checking
async function minVersionCHECK(check: string): Promise<CheckResultError> {
  try {
    const requiredVersion = check.replace('min-version:', '');
    const currentVersion = config.buildInfo?.version || '0.0.0';
    
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10));
    const [reqMajor, reqMinor, reqPatch] = parseVersion(requiredVersion);
    const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);
    
    const meetsRequirement = 
      curMajor > reqMajor || 
      (curMajor === reqMajor && curMinor > reqMinor) ||
      (curMajor === reqMajor && curMinor === reqMinor && curPatch >= reqPatch);
    
    return {
      requirement: check,
      pass: meetsRequirement,
      error: meetsRequirement ? undefined : `Current version '${currentVersion}' does not meet minimum requirement '${requiredVersion}'`
    };
  } catch (error) {
    return {
      requirement: check,
      pass: false,
      error: `Version check failed: ${error}`
    };
  }
}

// Admin status checking
async function isAdminCHECK(check: string): Promise<CheckResultError> {
  const user = config.bootData.user;
  if (user && user.isGrafanaAdmin) {
    return {
      requirement: check,
      pass: true,
      context: user
    };
  } else if (user) {
    return {
      requirement: check,
      pass: false,
      error: "User is not an admin",
      context: user
    };
  }

  return {
    requirement: check,
    pass: false,
    error: "Unable to determine user admin status",
    context: null
  };
}

// Data sources availability checking
async function hasDatasourcesCHECK(check: string): Promise<CheckResultError> {
  const dataSources = await ContextService.fetchDataSources();
  return {
    requirement: check,
    pass: dataSources.length > 0,
    error: dataSources.length > 0 ? undefined : "No data sources found",
    context: dataSources
  };
}

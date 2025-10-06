import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

// Container and layout styles
export const getContainerStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'context-container',
    backgroundColor: theme.colors.background.primary,
    borderRadius: '0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: 0,
    height: '100%',
    width: '100%',
  }),
  content: css({
    label: 'context-content',
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }),
  contextSections: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  }),
});

// Loading and state styles
export const getStateStyles = (theme: GrafanaTheme2) => ({
  loadingContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    justifyContent: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(1),
  }),
  errorContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  emptyContainer: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});

// Section header styles
export const getSectionHeaderStyles = (theme: GrafanaTheme2) => ({
  sectionHeader: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5, 1),
    textAlign: 'center',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    marginBottom: theme.spacing(1),
  }),
  headerIcon: css({
    color: theme.colors.primary.main,
    marginBottom: theme.spacing(1),
  }),
  sectionTitle: css({
    margin: 0,
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  sectionSubtitle: css({
    margin: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    maxWidth: '400px',
  }),
});

// Recommendation card styles
export const getRecommendationCardStyles = (theme: GrafanaTheme2) => ({
  recommendationsContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  recommendationsGrid: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: '100%',
    maxWidth: '100%',
  }),
  recommendationCard: css({
    // Balanced tile padding on all sides
    padding: theme.spacing(1.25),
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100px',
  }),
  compactCard: css({
    // Keep compact but balanced
    padding: theme.spacing(1),
    minHeight: '70px', // Much smaller for docs pages
  }),
  recommendationCardContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: '100%',
    maxWidth: '100%',
    height: '100%',
  }),
  compactCardContent: css({
    gap: theme.spacing(0.75), // Tighter spacing for docs pages
  }),
  cardHeader: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    width: '100%',
    maxWidth: '100%',
    marginBottom: theme.spacing(1),
  }),
  compactHeader: css({
    marginBottom: theme.spacing(0.5), // Reduced bottom margin for docs pages
    alignItems: 'center', // Center align for cleaner look
  }),
  recommendationCardTitle: css({
    margin: 0,
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    lineHeight: 1.3,
    wordBreak: 'break-word',
    flex: 1,
    minWidth: 0,
    maxWidth: 'calc(100% - 100px)',
    display: '-webkit-box',
    '-webkit-line-clamp': '2',
    '-webkit-box-orient': 'vertical',
    overflow: 'hidden',
  }),
  cardActions: css({
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
    flexShrink: 0,
    width: '80px',
  }),
  hiddenActions: css({
    opacity: 0,
    visibility: 'hidden',
    transition: 'opacity 0.2s ease, visibility 0.2s ease',
  }),
  startButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    padding: `${theme.spacing(0.75)} ${theme.spacing(1.5)}`,
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    border: 'none',
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: '80px',
    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
      boxShadow: theme.shadows.z1,
    },
  }),
  // Secondary button style for "View" actions
  secondaryButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    padding: `${theme.spacing(0.75)} ${theme.spacing(1.5)}`,
    backgroundColor: theme.colors.background.primary,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: '80px',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
      borderColor: theme.colors.border.strong,
      boxShadow: theme.shadows.z1,
    },
  }),
});

// Card metadata and interaction styles
export const getCardMetadataStyles = (theme: GrafanaTheme2) => ({
  cardMetadata: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  stepsInfo: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    width: '100%',
  }),
  summaryInfo: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    width: '100%',
  }),
  completionInfo: css({
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
  }),
  completionPercentage: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.success.main,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
    borderRadius: theme.shape.radius.default,
    whiteSpace: 'nowrap',

    // Special styling for 0% completion (not started)
    '&[data-completion="0"]': {
      color: theme.colors.text.secondary,
    },
  }),
  summaryButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    backgroundColor: 'transparent',
    border: 'none',
    padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    transition: 'all 0.2s ease',
    '&:hover:not(:disabled)': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      color: theme.colors.text.secondary,
    },
  }),
  stepsCount: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.secondary,
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  viewStepsButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    backgroundColor: 'transparent',
    border: 'none',
    padding: theme.spacing(0.25),
    cursor: 'pointer',
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    borderRadius: theme.shape.radius.default,
    transition: 'all 0.2s ease',
    '&:hover:not(:disabled)': {
      backgroundColor: theme.colors.action.hover,
      textDecoration: 'none',
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  }),
});

// Summary and content expansion styles
export const getSummaryStyles = (theme: GrafanaTheme2) => ({
  summaryExpansion: css({
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    position: 'relative',
  }),
  summaryContent: css({
    marginBottom: theme.spacing(2),
  }),
  summaryText: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    lineHeight: 1.4,
    margin: 0,
  }),
  summaryCta: css({
    position: 'sticky',
    bottom: 0,
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    backgroundColor: 'transparent',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    borderRadius: `0 0 ${theme.shape.radius.default}px ${theme.shape.radius.default}px`,
    display: 'flex',
    justifyContent: 'center',
    boxShadow: `0 -2px 8px ${theme.colors.background.secondary}`,
    zIndex: 10,
  }),
  summaryCtaButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    padding: `${theme.spacing(1)} ${theme.spacing(2.5)}`,
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    border: 'none',
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    transition: 'all 0.2s ease',
    minWidth: '120px',
    boxShadow: theme.shadows.z1,

    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
      transform: 'translateY(-1px)',
      boxShadow: theme.shadows.z2,
    },

    '&:active': {
      transform: 'translateY(0)',
      boxShadow: theme.shadows.z1,
    },

    '& svg': {
      flexShrink: 0,
    },
  }),
});

// Milestone and steps styles
export const getMilestoneStyles = (theme: GrafanaTheme2) => ({
  milestonesSection: css({
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  milestonesHeader: css({
    marginBottom: theme.spacing(1),
  }),
  milestonesTitle: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  milestonesList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  milestoneItem: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75),
    borderRadius: theme.shape.radius.default,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    width: '100%',
    textAlign: 'left',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  milestoneNumber: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
  }),
  milestoneContent: css({
    flex: 1,
    minWidth: 0,
  }),
  milestoneTitle: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    lineHeight: 1.3,
  }),
  milestoneDuration: css({
    fontSize: '10px',
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    fontWeight: theme.typography.fontWeightRegular,
    marginLeft: theme.spacing(0.5),
  }),
});

// Steps section styles (for step-by-step expansion)
export const getStepsStyles = (theme: GrafanaTheme2) => ({
  stepsSection: css({
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  stepsExpansion: css({
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  stepsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  stepItem: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  stepNumber: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
  }),
  stepContent: css({
    flex: 1,
    minWidth: 0,
  }),
  stepTitle: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing(0.25),
    lineHeight: 1.3,
  }),
  stepDuration: css({
    fontSize: '11px',
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
});

// Other docs section styles
export const getOtherDocsStyles = (theme: GrafanaTheme2) => ({
  otherDocsSection: css({
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  otherDocsHeader: css({
    backgroundColor: theme.colors.background.canvas,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
  otherDocsToggle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  otherDocsCount: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    marginLeft: 'auto',
    marginRight: theme.spacing(1),
    fontSize: '11px',
    fontWeight: theme.typography.fontWeightRegular,
    color: theme.colors.text.secondary,
    backgroundColor: theme.colors.background.secondary,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
    borderRadius: '12px',
    border: 'none',
    opacity: 0.8,
  }),
  otherDocsExpansion: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
  }),
  otherDocsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  otherDocItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  docIcon: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  docContent: css({
    flex: 1,
    minWidth: 0,
  }),
  docLink: css({
    color: theme.colors.primary.main,
    textDecoration: 'none',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.3,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.primary.shade,
    },
  }),
  docActions: css({
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
});

// Debug section styles
export const getDebugStyles = (theme: GrafanaTheme2) => ({
  debugSection: css({
    marginTop: theme.spacing(4),
    padding: theme.spacing(2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
});

// Main export combining all styles
export const getStyles = (theme: GrafanaTheme2) => ({
  ...getContainerStyles(theme),
  ...getStateStyles(theme),
  ...getSectionHeaderStyles(theme),
  ...getRecommendationCardStyles(theme),
  ...getCardMetadataStyles(theme),
  ...getSummaryStyles(theme),
  ...getMilestoneStyles(theme),
  ...getStepsStyles(theme),
  ...getOtherDocsStyles(theme),
  ...getDebugStyles(theme),
});

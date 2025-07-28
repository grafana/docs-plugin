import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@grafana/ui';

import { useInteractiveElements } from '../../../interactive.hook';
import { useStepChecker } from '../../../step-checker.hook';

interface InternalAction {
  targetAction: string;
  refTarget?: string;
  targetValue?: string;
  requirements?: string;
}

interface InteractiveMultiStepProps {
  internalActions: InternalAction[];
  
  // State management (passed by parent section)
  stepId?: string;
  isEligibleForChecking?: boolean;
  isCompleted?: boolean;
  isCurrentlyExecuting?: boolean;
  onStepComplete?: (stepId: string) => void;
  
  // Content and styling
  title?: string; // Add title prop like InteractiveStep
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  hints?: string;
  requirements?: string; // Overall requirements for the multi-step
  objectives?: string; // Overall objectives for the multi-step
  onComplete?: () => void;
  
  // Timing configuration
  stepDelay?: number; // Delay between steps in milliseconds (default: 1200ms)
  resetTrigger?: number; // Signal from parent to reset local completion state
}

/**
 * Just-in-time requirements checker for individual actions within a multi-step
 * Uses the interactive hook's checkRequirementsFromData to handle both pure and DOM-dependent checks
 */
async function checkActionRequirements(
  action: InternalAction, 
  actionIndex: number,
  checkRequirementsFromData: (data: any) => Promise<any>
): Promise<{ pass: boolean; explanation?: string }> {
  
  if (!action.requirements) {
    return { pass: true };
  }
  
  try {
    // Create data structure compatible with checkRequirementsFromData
    const actionData = {
      requirements: action.requirements,
      targetaction: action.targetAction,
      reftarget: action.refTarget || '',
      targetvalue: action.targetValue,
      textContent: `multistep-action-${actionIndex + 1}`,
      tagName: 'span'
    };
    
    // Check requirements with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Requirements check timeout')), 5000);
    });
    
    const result = await Promise.race([
      checkRequirementsFromData(actionData),
      timeoutPromise
    ]);
    
    if (result.pass) {
      return { pass: true };
    } else {
      // Generate user-friendly explanation
      const errorMessage = result.error?.map((e: any) => e.error || e.requirement).join(', ');
      const explanation = `Step ${actionIndex + 1} requirements not met: ${errorMessage}`;
      
      return { 
        pass: false, 
        explanation: explanation
      };
    }
  } catch (error) {
    console.error(`Requirements check failed for action ${actionIndex + 1}:`, error);
    return { 
      pass: false, 
      explanation: `Step ${actionIndex + 1} requirements check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export const InteractiveMultiStep = forwardRef<
  { executeStep: () => Promise<boolean> },
  InteractiveMultiStepProps
>(({
  internalActions,
  stepId,
  isEligibleForChecking = true,
  isCompleted: parentCompleted = false,
  isCurrentlyExecuting = false,
  onStepComplete,
  title, // Add title prop
  children,
  className,
  disabled = false,
  hints,
  requirements,
  objectives,
  onComplete,
  stepDelay = 1200, // Default 1200ms delay between steps
  resetTrigger,
}, ref) => {
  // Local UI state (similar to InteractiveStep)
  const [isLocallyCompleted, setIsLocallyCompleted] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  // Handle reset trigger from parent section
  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      console.log(`🔄 Resetting multi-step local completion: ${stepId}`);
      setIsLocallyCompleted(false);
      setExecutionError(null); // Also clear any execution errors
    }
  }, [resetTrigger, stepId]);
  
  // Combined completion state (parent takes precedence for coordination)
  const isCompleted = parentCompleted || isLocallyCompleted;
  
  // Get the interactive functions from the hook
  const { executeInteractiveAction, checkRequirementsFromData } = useInteractiveElements();
  
  // Use step checker hook for overall multi-step requirements and objectives
  const checker = useStepChecker({
    requirements,
    objectives,
    hints,
    stepId: stepId || `multistep-${Date.now()}`,
    isEligibleForChecking: isEligibleForChecking && !isCompleted
  });
  
  // Combined completion state: objectives always win (clarification 1, 2, 18)
  const isCompletedWithObjectives = parentCompleted || isLocallyCompleted || (checker.completionReason === 'objectives');
  
  // Main execution logic (similar to InteractiveSection's sequence execution)
  const executeStep = useCallback(async (): Promise<boolean> => {
    if (!checker.isEnabled || isCompletedWithObjectives || disabled || isExecuting) {
      console.warn(`⚠️ Multi-step execution blocked: ${stepId}`, {
        enabled: checker.isEnabled,
        completed: isCompletedWithObjectives,
        disabled,
        executing: isExecuting
      });
      return false;
    }
    
    // Check objectives before executing internal actions (clarification 18)
    if (checker.completionReason === 'objectives') {
      console.log(`✅ Multi-step objectives already met for ${stepId}, skipping all internal actions`);
      setIsLocallyCompleted(true);
      
      // Notify parent if we have the callback (section coordination)
      if (onStepComplete && stepId) {
        onStepComplete(stepId);
      }
      
      // Call the original onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
      
      return true;
    }
    
    setIsExecuting(true);
    setExecutionError(null);
    
    try {
      // Execute each internal action in sequence
      for (let i = 0; i < internalActions.length; i++) {
        const action = internalActions[i];
        setCurrentActionIndex(i);
        
        console.log(`🔄 Multi-step ${stepId}: Executing internal action ${i + 1}/${internalActions.length}`, action);
        
        // Just-in-time requirements checking for this specific action
        if (action.requirements) {
          const requirementsResult = await checkActionRequirements(action, i, checkRequirementsFromData);
          if (!requirementsResult.pass) {
            console.error(`❌ Multi-step ${stepId}: Internal action ${i + 1} requirements failed`, requirementsResult.explanation);
            setExecutionError(requirementsResult.explanation || 'Action requirements not met');
            return false;
          }
        }
        
        // Execute the action (show first, then do)
        try {
          // Show mode (highlight what will be acted upon)
          await executeInteractiveAction(action.targetAction, action.refTarget || '', action.targetValue, 'show');
          
          // Small delay between show and do for better UX and animation visibility
          await new Promise(resolve => setTimeout(resolve, 600));
          
          // Do mode (actually perform the action)
          await executeInteractiveAction(action.targetAction, action.refTarget || '', action.targetValue, 'do');
          

          
          // Add delay between steps (but not after the last step)
          if (i < internalActions.length - 1 && stepDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, stepDelay));
          }
        } catch (actionError) {
          console.error(`❌ Multi-step ${stepId}: Internal action ${i + 1} execution failed`, actionError);
          const errorMessage = actionError instanceof Error ? actionError.message : 'Action execution failed';
          setExecutionError(`Step ${i + 1} failed: ${errorMessage}`);
          return false;
        }
      }
      
      // All internal actions completed successfully

      setIsLocallyCompleted(true);
      
      // Notify parent if we have the callback (section coordination)
      if (onStepComplete && stepId) {
        onStepComplete(stepId);
      }
      
      // Call the original onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Multi-step execution failed: ${stepId}`, error);
      const errorMessage = error instanceof Error ? error.message : 'Multi-step execution failed';
      setExecutionError(errorMessage);
      return false;
    } finally {
      setIsExecuting(false);
      setCurrentActionIndex(-1);
    }
  }, [
    checker.isEnabled,
    isCompletedWithObjectives,
    disabled,
    isExecuting,
    stepId,
    internalActions,
    executeInteractiveAction,
    checkRequirementsFromData,
    onStepComplete,
    onComplete,
    checker.completionReason,
    stepDelay
  ]);
  
  // Expose execute method for parent (sequence execution)
  useImperativeHandle(ref, () => ({
    executeStep
  }), [executeStep]);
  
  // Handle "Do it" button click
  const handleDoAction = useCallback(async () => {
    if (disabled || isExecuting || isCompletedWithObjectives || !checker.isEnabled) {
      return;
    }
    
    await executeStep();
  }, [disabled, isExecuting, isCompletedWithObjectives, checker.isEnabled, executeStep]);
  
  const isAnyActionRunning = isExecuting || isCurrentlyExecuting;
  
  // Generate button text based on current state
  const getButtonText = () => {
    if (checker.completionReason === 'objectives') {
      return 'Already done!';
    }
    if (checker.isChecking) {
      return 'Checking...';
    }
    if (isCompletedWithObjectives) {
      return '✓ Completed';
    }
    if (isExecuting) {
      return currentActionIndex >= 0 
        ? `Executing ${currentActionIndex + 1}/${internalActions.length}...`
        : 'Executing...';
    }
    if (executionError) {
      return executionError;
    }
    if (!checker.isEnabled && !isCompletedWithObjectives) {
      return 'Requirements not met';
    }
    return 'Do it';
  };
  
  // Generate button title/tooltip based on current state
  const getButtonTitle = () => {
    if (checker.completionReason === 'objectives') {
      return 'Already done!';
    }
    if (checker.isChecking) {
      return 'Checking requirements...';
    }
    if (isCompletedWithObjectives) {
      return 'Multi-step completed';
    }
    if (isExecuting) {
      return 'Multi-step execution in progress...';
    }
    if (executionError) {
      return `Execution failed: ${executionError}`;
    }
    if (!checker.isEnabled && !isCompletedWithObjectives) {
      return 'Requirements not met for multi-step execution';
    }
    return hints || `Execute ${internalActions.length} steps in sequence`;
  };
  
  return (
    <div className={`interactive-step${className ? ` ${className}` : ''}${isCompletedWithObjectives ? ' completed' : ''}${isCurrentlyExecuting ? ' executing' : ''}`}>
      <div className="interactive-step-content">
        {title && <div className="interactive-step-title">{title}</div>}
        {children}
      </div>
      
      <div className="interactive-step-actions">
        <div className="interactive-step-action-buttons">
          {/* Only show "Do it" button when requirements are met OR step is completed */}
          {(checker.isEnabled || isCompletedWithObjectives) && (
            <Button
              onClick={handleDoAction}
              disabled={disabled || isCompletedWithObjectives || isAnyActionRunning || (!checker.isEnabled && !isCompletedWithObjectives)}
              size="sm"
              variant="primary"
              className="interactive-step-do-btn"
              title={getButtonTitle()}
            >
              {getButtonText()}
            </Button>
          )}
        </div>
        
        {isCompletedWithObjectives && <span className="interactive-step-completed-indicator">✓</span>}
      </div>
      
      {/* Show explanation text when requirements aren't met, but objectives always win (clarification 2) */}
      {checker.completionReason !== 'objectives' && !checker.isEnabled && !isCompletedWithObjectives && !checker.isChecking && checker.explanation && (
        <div className="interactive-step-requirement-explanation" style={{ 
          color: '#ff8c00', 
          fontSize: '0.875rem', 
          marginTop: '8px',
          fontStyle: 'italic',
          lineHeight: '1.4',
          paddingLeft: '12px'
        }}>
          {checker.explanation}
          <button
            onClick={() => {
              checker.checkStep();
            }}
            style={{
              marginLeft: '8px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              border: '1px solid #ff8c00',
              background: 'transparent',
              color: '#ff8c00',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Show execution error when available */}
      {executionError && !checker.isChecking && (
        <div className="interactive-step-requirement-explanation" style={{ 
          color: '#dc3545', 
          fontSize: '0.875rem', 
          marginTop: '8px',
          fontStyle: 'italic',
          lineHeight: '1.4',
          paddingLeft: '12px'
        }}>
          {executionError}
          <button
            onClick={() => {
              setExecutionError(null);
              checker.checkStep();
            }}
            style={{
              marginLeft: '8px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              border: '1px solid #dc3545',
              background: 'transparent',
              color: '#dc3545',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
InteractiveMultiStep.displayName = 'InteractiveMultiStep'; 

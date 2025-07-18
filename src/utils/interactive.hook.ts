/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useCallback, useRef } from 'react';
import { locationService } from '@grafana/runtime';
import { fetchDataSources, fetchUser } from './context-data-fetcher';
import { addGlobalInteractiveStyles } from '../styles/interactive.styles';
import { waitForReactUpdates, groupInteractiveElementsByStep, markStepCompleted, InteractiveStep } from './requirements.util';

export interface InteractiveRequirementsCheck {
  requirements: string;
  pass: boolean;
  error: CheckResult[];
}

export interface CheckResult {
  requirement: string;
  pass: boolean;
  error?: string;
  context?: any;
}

export interface InteractiveElementData {
  // Core interactive attributes
  reftarget: string;
  targetaction: string;
  targetvalue?: string;
  requirements?: string;
  
  // Element context
  tagName: string;
  className?: string;
  id?: string;
  textContent?: string;
  
  // Position/hierarchy context
  elementPath?: string; // CSS selector path to element
  parentTagName?: string;
  
  // Timing context
  timestamp?: number;
  
  // Custom data attributes (extensible)
  customData?: Record<string, string>;
}



/**
 * Extract interactive data from a DOM element
 */
export function extractInteractiveDataFromElement(element: HTMLElement): InteractiveElementData {
  const customData: Record<string, string> = {};
  
  // Extract all data-* attributes except the core ones
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-') && 
        !['data-reftarget', 'data-targetaction', 'data-targetvalue', 'data-requirements'].includes(attr.name)) {
      const key = attr.name.substring(5); // Remove 'data-' prefix
      customData[key] = attr.value;
    }
  });

  // Extract core attributes with validation
  const reftarget = element.getAttribute('data-reftarget') || '';
  const targetaction = element.getAttribute('data-targetaction') || '';
  const targetvalue = element.getAttribute('data-targetvalue') || undefined;
  const requirements = element.getAttribute('data-requirements') || undefined;
  const textContent = element.textContent?.trim() || undefined;

  // Basic validation: Check if reftarget looks suspicious (only warn on obvious issues)
  if (reftarget && textContent && reftarget === textContent && reftarget.length > 5) {
    console.warn(`⚠️ reftarget "${reftarget}" matches element text - check data-reftarget attribute`);
  }

  return {
    reftarget: reftarget,
    targetaction: targetaction,
    targetvalue: targetvalue,
    requirements: requirements,
    tagName: element.tagName.toLowerCase(),
    className: element.className || undefined,
    id: element.id || undefined,
    textContent: textContent,

    parentTagName: element.parentElement?.tagName.toLowerCase() || undefined,
    timestamp: Date.now(),
    customData: Object.keys(customData).length > 0 ? customData : undefined,
  };
}





/**
 * Recursively get all text content from an element and its descendants
 */
function getAllTextContent(element: Element): string {
  let text = '';
  
  // Process all child nodes
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Add text node content
      text += (node.textContent || '').trim() + ' ';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Recursively get text from child elements
      text += getAllTextContent(node as Element) + ' ';
    }
  }
  
  return text.trim();
}

interface UseInteractiveElementsOptions {
  containerRef?: React.RefObject<HTMLElement>;
}

export function useInteractiveElements(options: UseInteractiveElementsOptions = {}) {
  const { containerRef } = options;
  
  // Initialize global interactive styles
  useEffect(() => {
    addGlobalInteractiveStyles();
  }, []);

  /**
   * Find button elements that contain the specified text (case-insensitive, substring match)
   * Searches through all child text nodes, not just direct textContent
   */
  function findButtonByText(targetText: string): HTMLButtonElement[] {
    if (!targetText || typeof targetText !== 'string') {
      return [];
    }

    // In this special case we want to look through the entire document, since for finding
    // buttons we want to click, we have to look outside the docs plugin frame.
    const buttons = document.querySelectorAll('button');
    const searchText = targetText.toLowerCase().trim();
    
    return Array.from(buttons).filter((button) => {
      // Get all text content from the button and its descendants
      const allText = getAllTextContent(button).toLowerCase();
      return allText.includes(searchText);
    }) as HTMLButtonElement[];
  }

  function highlight(element: HTMLElement) {
    // Add highlight class for better styling
    element.classList.add('interactive-highlighted');
    
    // Create a highlight outline element
    const highlightOutline = document.createElement('div');
    highlightOutline.className = 'interactive-highlight-outline';
    
    // Position the outline around the target element using CSS custom properties
    const rect = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
    // Use CSS custom properties instead of inline styles to avoid CSP violations
    highlightOutline.style.setProperty('--highlight-top', `${rect.top + scrollTop - 4}px`);
    highlightOutline.style.setProperty('--highlight-left', `${rect.left + scrollLeft - 4}px`);
    highlightOutline.style.setProperty('--highlight-width', `${rect.width + 8}px`);
    highlightOutline.style.setProperty('--highlight-height', `${rect.height + 8}px`);
    
    document.body.appendChild(highlightOutline);
    
    // Remove highlight after animation completes
    setTimeout(() => {
      element.classList.remove('interactive-highlighted');
      if (highlightOutline.parentNode) {
        highlightOutline.parentNode.removeChild(highlightOutline);
      }
    }, 2000); // Match animation duration
    
    return element;
  }

  /**
   * Set the visual and logical state of an interactive element.
   * 
   * ARCHITECTURAL DECISION: This function operates under the strong assumption that ALL
   * interactive elements have unique step IDs (either data-section-id or data-step-id).
   * This assumption is guaranteed by the processInteractiveElements function in 
   * single-docs-fetcher.ts, which assigns unique IDs to every interactive element during
   * content processing. No fallback mechanisms are provided - violations will throw errors.
   */
  function setInteractiveState(element: HTMLElement, state: 'idle' | 'running' | 'completed' | 'error') {
    // ASSUMPTION: All interactive elements have unique step IDs
    // This is guaranteed by single-docs-fetcher.ts processInteractiveElements function
    // which assigns either data-section-id or data-step-id to every interactive element
    const sectionId = element.getAttribute('data-section-id');
    const stepId = element.getAttribute('data-step-id');

    if (!sectionId && !stepId) {
      throw new Error(`Interactive element missing required unique step ID: reftarget=${element.getAttribute('data-reftarget')}, targetaction=${element.getAttribute('data-targetaction')}`);
    }

    // Handle completion state (implicit requirement #2)
    if (state === 'completed') {
      console.log('🎯 Marking element as completed:', {
        element: element.tagName,
        reftarget: element.getAttribute('data-reftarget'),
        targetaction: element.getAttribute('data-targetaction'),
        buttonType: element.getAttribute('data-button-type'),
        textContent: element.textContent?.trim()
      });
            
      // Determine the unique identifier for this element's step
      const uniqueId: string = sectionId ? `section-${sectionId}` : `step-${stepId}`;
            
      // Find all interactive elements in the current container to identify the step
      const searchContainer = containerRef?.current || document;
      const allInteractiveElements = searchContainer.querySelectorAll('[data-requirements]') as NodeListOf<HTMLElement>;
      const elementArray = Array.from(allInteractiveElements);
      
      // Group elements by step using centralized logic
      const steps = groupInteractiveElementsByStep(elementArray);
      
      // Find the step that contains this element using the unique identifier
      const elementStep = steps.find((step: InteractiveStep) => 
        step.uniqueId === uniqueId
      );
      
      if (elementStep) {
        console.log(`📋 Marking entire step as completed: ${elementStep.buttons.length} buttons with uniqueId="${uniqueId}"`);
        
        // Use centralized step completion logic
        markStepCompleted(elementStep);
        
        elementStep.buttons.forEach((button: HTMLElement, index: number) => {
          const buttonType = button.getAttribute('data-button-type') || 'unknown';
          console.log(`  ✅ Marking button ${index + 1} as completed: ${buttonType}`);
        });
      } else {
        // This should never happen if our step grouping logic is correct
        console.error('💥 CRITICAL: No step found with unique ID despite element having ID! This indicates a bug in step grouping logic.');
        console.error('Details:', {
          uniqueId,
          sectionId,
          stepId,
          availableSteps: steps.map(s => s.uniqueId),
          element: element.tagName
        });
        throw new Error(`Step not found for unique ID: ${uniqueId}`);
      }
      
      // Wait for React updates to complete, then dispatch event to trigger requirements re-check
      waitForReactUpdates().then(() => {
        console.log('🔔 Dispatching interactive-action-completed event');
        const event = new CustomEvent('interactive-action-completed', {
          detail: { element, state }
        });
        document.dispatchEvent(event);
        console.log('✅ Event dispatched successfully');
      });
    }
  }

  const interactiveFocus = useCallback((data: InteractiveElementData, click: boolean, clickedElement: HTMLElement) => {
    setInteractiveState(clickedElement, 'running');
    
    // Search entire document for the target, which is outside of docs plugin frame.
    const targetElements = document.querySelectorAll(data.reftarget);
    
    try {
      if (!click) {
        // Show mode: only highlight, don't click - NO step completion
        targetElements.forEach(element => {
          highlight((element as HTMLElement));
        });
        return; // Early return - don't mark as completed in show mode
      }

      // Do mode: just click, don't highlight
      targetElements.forEach(element => {
        (element as HTMLElement).click();
      });
      
      // Mark as completed after successful execution (only in Do mode)
      waitForReactUpdates().then(() => {
        setInteractiveState(clickedElement, 'completed');
      });
    } catch (error) {
      console.error("Error in interactiveFocus:", error);
      setInteractiveState(clickedElement, 'error');
    }
  }, []);

  const interactiveButton = useCallback((data: InteractiveElementData, click: boolean, clickedElement: HTMLElement) => { // eslint-disable-line react-hooks/exhaustive-deps
    setInteractiveState(clickedElement, 'running');

    try {
      const buttons = findButtonByText(data.reftarget);
      
      if (!click) {
        // Show mode: only highlight, don't click - NO step completion
        buttons.forEach(button => {
          highlight(button);
        });
        return; // Early return - don't mark as completed in show mode
      }

      // Do mode: just click, don't highlight
      buttons.forEach(button => {
        button.click();
      });
      
      // Mark as completed after successful execution (only in Do mode)
      waitForReactUpdates().then(() => {
        setInteractiveState(clickedElement, 'completed');
      });
    } catch (error) {
      console.error("Error in interactiveButton:", error);
      setInteractiveState(clickedElement, 'error');
    }
  }, []);

  // Create stable refs for helper functions to avoid circular dependencies
  const activeRefsRef = useRef(new Set<string>());
  const runInteractiveSequenceRef = useRef<(elements: Element[], showMode: boolean) => Promise<void>>();
  const runStepByStepSequenceRef = useRef<(elements: Element[]) => Promise<void>>();

  const interactiveSequence = useCallback(async (data: InteractiveElementData, showOnly: boolean, clickedElement: HTMLElement): Promise<string> => { // eslint-disable-line react-hooks/exhaustive-deps
    // This is here so recursion cannot happen
    if(activeRefsRef.current.has(data.reftarget)) {
      return data.reftarget;
    }
    
    setInteractiveState(clickedElement, 'running');
    
    try {
      const searchContainer = containerRef?.current || document;
      const targetElements = searchContainer.querySelectorAll(data.reftarget);

      if(targetElements.length === 0) {
        const msg = `No interactive sequence container found matching selector: ${data.reftarget}`;
        console.error(msg);
        throw new Error(msg);
      }
      
      if(targetElements.length > 1) {
        const msg = `${targetElements.length} interactive sequence containers found matching selector: ${data.reftarget} - this is not supported (must be exactly 1)`;
        console.error(msg);
        throw new Error(msg);
      } 

      activeRefsRef.current.add(data.reftarget);

      // Find all interactive elements within the sequence container
      const interactiveElements = Array.from(targetElements[0].querySelectorAll('.interactive[data-targetaction]:not([data-targetaction="sequence"])'));
      
      if (interactiveElements.length === 0) {
        const msg = `No interactive elements found within sequence container: ${data.reftarget}`;
        throw new Error(msg);
      }
      
      if (!showOnly) {
        // Full sequence: Show each step, then do each step, one by one
        await runStepByStepSequenceRef.current!(interactiveElements);
      } else {
        // Show only mode
        await runInteractiveSequenceRef.current!(interactiveElements, true);
      }
      
      // Mark as completed after successful execution
      setInteractiveState(clickedElement, 'completed');
      
      activeRefsRef.current.delete(data.reftarget);
      return data.reftarget;
    } catch (error) {
      console.error(`Error in interactiveSequence for ${data.reftarget}:`, error);
      setInteractiveState(clickedElement, 'error');
      activeRefsRef.current.delete(data.reftarget);
      throw error;
    }
  }, []);

  const interactiveFormFill = useCallback((data: InteractiveElementData, fillForm: boolean, clickedElement: HTMLElement) => { // eslint-disable-line react-hooks/exhaustive-deps
    const value = data.targetvalue || '';
    
    setInteractiveState(clickedElement, 'running');
    
    try {
      // Search entire document for the target, which is outside of docs plugin frame.
      const targetElements = document.querySelectorAll(data.reftarget);
      
      if (targetElements.length === 0) {
        console.warn(`No elements found matching selector: ${data.reftarget}`);
        return;
      } else if(targetElements.length > 1) {
        console.warn(`Multiple elements found matching selector: ${data.reftarget}`);
      }

      const targetElement = targetElements[0] as HTMLElement;
      
        if (!fillForm) {
          // Show mode: only highlight, don't fill the form
          highlight(targetElement);
          return;
        }

        // Do mode: don't highlight, just fill the form
        const tagName = targetElement.tagName.toLowerCase();
        const inputType = (targetElement as HTMLInputElement).type ? (targetElement as HTMLInputElement).type.toLowerCase() : '';
        
        // CONSOLIDATED APPROACH: Set value once using the most compatible method
        if (tagName === 'input') {
          if (inputType === 'checkbox' || inputType === 'radio') {
            // Handle checkbox/radio inputs - no duplicate events issue here
            (targetElement as HTMLInputElement).checked = value !== 'false' && value !== '0' && value !== '';
          } else {
            // Use React-compatible native setter approach for text inputs
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(targetElement, value);
              
              // Reset React's value tracker if present (must be done after setting value)
              if ((targetElement as any)._valueTracker) {
                (targetElement as any)._valueTracker.setValue('');
              }
            } else {
              // Fallback for edge cases where native setter isn't available
              (targetElement as HTMLInputElement).value = value;
            }
          }
        } else if (tagName === 'textarea') {
          // Use React-compatible native setter approach for textareas
          const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeTextareaSetter) {
            nativeTextareaSetter.call(targetElement, value);
            
            // Reset React's value tracker if present
            if ((targetElement as any)._valueTracker) {
              (targetElement as any)._valueTracker.setValue('');
            }
          } else {
            // Fallback for edge cases
            (targetElement as HTMLTextAreaElement).value = value;
          }
        } else if (tagName === 'select') {
          // Select elements don't have the same React issues, use direct assignment
          (targetElement as HTMLSelectElement).value = value;
        } else {
          // For other elements, set text content
          targetElement.textContent = value;
        }
      
      // Dispatch events ONCE in proper sequence to notify all listeners
      // This mimics natural user interaction: focus -> input -> change -> blur
      targetElement.focus();
      targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
      
      // Only dispatch input/change events for form controls that support them
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      targetElement.blur();
      targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Mark as completed after successful execution
      waitForReactUpdates().then(() => {
        setInteractiveState(clickedElement, 'completed');
      });
      
    } catch (error) {
      console.error('Error applying interactive action for selector ' + data.reftarget);
      setInteractiveState(clickedElement, 'error');
    }
  }, []);

  const interactiveNavigate = useCallback((data: InteractiveElementData, navigate: boolean, clickedElement: HTMLElement) => {
    setInteractiveState(clickedElement, 'running');
    
    try {
      if (!navigate) {
        // Show mode: highlight the current location or show where we would navigate
        // For navigation, we can highlight the current URL or show a visual indicator
        // Since there's no specific element to highlight, we'll just show a brief visual feedback
        console.log(`🔍 Show mode: Would navigate to ${data.reftarget}`);
        
        // Provide visual feedback by briefly highlighting the browser location bar concept
        // or show a toast/notification (for now, just log and complete)
        waitForReactUpdates().then(() => {
          setInteractiveState(clickedElement, 'completed');
        });
        return;
      }

      // Do mode: actually navigate to the target URL
      console.log(`🧭 Navigating to: ${data.reftarget}`);
      
      // Use Grafana's idiomatic navigation pattern via locationService
      // This handles both internal Grafana routes and external URLs appropriately
      if (data.reftarget.startsWith('http://') || data.reftarget.startsWith('https://')) {
        // External URL - open in new tab to preserve current Grafana session
        window.open(data.reftarget, '_blank', 'noopener,noreferrer');
      } else {
        // Internal Grafana route - use locationService for proper routing
        locationService.push(data.reftarget);
      }
      
      // Mark as completed after successful navigation
      waitForReactUpdates().then(() => {
        setInteractiveState(clickedElement, 'completed');
      });
      
    } catch (error) {
      console.error('Error in interactiveNavigate:', error);
      setInteractiveState(clickedElement, 'error');
    }
  }, []);

  // Define helper functions using refs to avoid circular dependencies
  runInteractiveSequenceRef.current = async (elements: Element[], showMode: boolean): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds between retries
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const data = extractInteractiveDataFromElement(element as HTMLElement);

      if (!data.targetaction || !data.reftarget) {
        continue;
      }

      // Retry logic for each element
      let retryCount = 0;
      let elementCompleted = false;
      
      while (!elementCompleted && retryCount < MAX_RETRIES) {
        try {
          // Check requirements using the existing system
          const requirementsCheck = await checkRequirementsFromData(data);
          
          if (!requirementsCheck.pass) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              continue;
            } else {
              // Max retries reached, skip this element
              break;
            }
          }

          if (data.targetaction === 'highlight') {
            interactiveFocus(data, !showMode, element as HTMLElement); // Show mode = don't click, Do mode = click
          } else if (data.targetaction === 'button') {
            interactiveButton(data, !showMode, element as HTMLElement); // Show mode = don't click, Do mode = click
          } else if (data.targetaction === 'formfill') {
            interactiveFormFill(data, !showMode, element as HTMLElement); // Show mode = don't fill, Do mode = fill
          } else if (data.targetaction === 'navigate') {
            interactiveNavigate(data, !showMode, element as HTMLElement); // Show mode = show target, Do mode = navigate
          }

          // Mark element as completed
          elementCompleted = true;

          // Wait for animation to complete between each action
          await new Promise(resolve => setTimeout(resolve, 1300));
          
        } catch (error) {
          console.error(`Error processing interactive element ${data.targetaction} ${data.reftarget}:`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            // Max retries reached, skip this element
            break;
          }
        }
      }
    }
  };

  runStepByStepSequenceRef.current = async (elements: Element[]): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds between retries
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const data = extractInteractiveDataFromElement(element as HTMLElement);

      if (!data.targetaction || !data.reftarget) {
        continue;
      }

      // Retry logic for each step
      let retryCount = 0;
      let stepCompleted = false;
      
      while (!stepCompleted && retryCount < MAX_RETRIES) {
        try {
          // Check requirements using the existing system
          const requirementsCheck = await checkRequirementsFromData(data);
          
          if (!requirementsCheck.pass) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              continue;
            } else {
              // Max retries reached, skip this step
              break;
            }
          }

          // Step 1: Show what we're about to do
          if (data.targetaction === 'highlight') {
            interactiveFocus(data, false, element as HTMLElement); // Show mode - highlight only
          } else if (data.targetaction === 'button') {
            interactiveButton(data, false, element as HTMLElement); // Show mode - highlight only
          } else if (data.targetaction === 'formfill') {
            interactiveFormFill(data, false, element as HTMLElement); // Show mode - highlight only
          } else if (data.targetaction === 'navigate') {
            interactiveNavigate(data, false, element as HTMLElement); // Show mode - show target only
          }

          // Wait for highlight animation to complete before doing the action
          await new Promise(resolve => setTimeout(resolve, 1300));

          // Check requirements again before performing the action
          const secondCheck = await checkRequirementsFromData(data);
          if (!secondCheck.pass) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              continue;
            } else {
              break;
            }
          }

          // Step 2: Actually do the action
          if (data.targetaction === 'highlight') {
            interactiveFocus(data, true, element as HTMLElement); // Do mode - click
          } else if (data.targetaction === 'button') {
            interactiveButton(data, true, element as HTMLElement); // Do mode - click
          } else if (data.targetaction === 'formfill') {
            interactiveFormFill(data, true, element as HTMLElement); // Do mode - fill form
          } else if (data.targetaction === 'navigate') {
            interactiveNavigate(data, true, element as HTMLElement); // Do mode - navigate
          }

          // Mark step as completed
          stepCompleted = true;

          // Wait after actions that might cause state changes
          const baseDelay = 800;
          const actionDelay = data.targetaction === 'button' ? 1500 : baseDelay;
          
          if (i < elements.length - 1) {
            await new Promise(resolve => setTimeout(resolve, actionDelay));
          }
          
        } catch (error) {
          console.error(`Error in interactive step for ${data.targetaction} ${data.reftarget}:`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            // Max retries reached, skip this step
            break;
          }
        }
      }
    }
  };

  const reftargetExistsCHECK = async (data: InteractiveElementData, check: string): Promise<CheckResult> => {
    // For button actions, check if buttons with matching text exist
    if (data.targetaction === 'button') {
      const buttons = findButtonByText(data.reftarget);
      
      if (buttons.length > 0) {
        return {
          requirement: check,
          pass: true,
        };
      } else {
        return {
          requirement: check,
          pass: false,
          error: `No buttons found containing text: "${data.reftarget}"`,
          context: data,
        };
      }
    }
    
    // For other actions, check if the CSS selector matches an element
    const targetElement = document.querySelector(data.reftarget);
    if (targetElement) {
      return {
        requirement: check,
        pass: true,
      };
    } 
      
    return {
      requirement: check,
      pass: false,
      error: "Element not found",
      context: data,
    };
  }

  const navmenuOpenCHECK = async (data: InteractiveElementData, check: string): Promise<CheckResult> => {
    const navmenu = document.querySelector('ul[aria-label="Navigation"]');
    if(navmenu) {
      return {
        requirement: check,
        pass: true,
      }
    }

    return {
      requirement: check,
      pass: false,
      error: "Navmenu is not open",
      context: data,
    }
  }

  const isAdminCHECK = async (data: InteractiveElementData, check: string): Promise<CheckResult> => {
    const user = await fetchUser();
    if(user && user.isGrafanaAdmin) {
      return {
        requirement: check,
        pass: true,
        context: user,
      }
    } else if(user) {
      return {
        requirement: check,
        pass: false,
        error: "User is not an admin",
        context: user,
      }
    }

    return {
      requirement: check,
      pass: false,
      error: "User is not logged in",
      context: user,
    }
  }

  const hasDatasourcesCHECK = async (data: InteractiveElementData, check: string): Promise<CheckResult> => {
    const dataSources = await fetchDataSources();
    if(dataSources.length > 0) {
      return {
        requirement: check,
        pass: true,
      }
    }

    return {
      requirement: check,
      pass: false,
      error: "No data sources found",
      context: dataSources,
    }
  }      

  /**
   * Core requirement checking logic that works with InteractiveElementData
   */
  const checkRequirementsFromData = useCallback(async (data: InteractiveElementData): Promise<InteractiveRequirementsCheck> => {
    const requirements = data.requirements;
    if (!requirements) {
      console.warn("No requirements found for interactive element");
      return {
        requirements: requirements || '',
        pass: true,
        error: []
      }
    }

    const checks: string[] = requirements.split(',').map(check => check.trim());    

    async function performCheck(check: string, data: InteractiveElementData): Promise<CheckResult> {
      if(check === 'exists-reftarget') {
        return reftargetExistsCHECK(data, check);
      } else if(check === 'has-datasources') {
        return hasDatasourcesCHECK(data, check);
      } else if(check === 'is-admin') {
        return isAdminCHECK(data, check);
      } else if(check === 'navmenu-open') {
        return navmenuOpenCHECK(data, check);
      }

      console.warn("Unknown requirement:", check);
      return {
        requirement: check,
        pass: true,
        error: "Unknown requirement",
        context: data,
      }
    }

    const results = await Promise.all(checks.map(check => performCheck(check, data)));

    return {
      requirements: requirements,
      pass: results.every(result => result.pass),
      error: results,  
    }
  }, []);

  /**
   * Check requirements directly from a DOM element
   */
  const checkElementRequirements = useCallback(async (element: HTMLElement): Promise<InteractiveRequirementsCheck> => {
    const data = extractInteractiveDataFromElement(element);
    return checkRequirementsFromData(data);
  }, [checkRequirementsFromData]);

  /**
   * Enhanced function that returns both requirements check and extracted data
   */
  const checkRequirementsWithData = async (element: HTMLElement): Promise<{
    requirementsCheck: InteractiveRequirementsCheck;
    interactiveData: InteractiveElementData;
  }> => {
    const data = extractInteractiveDataFromElement(element);
    const requirementsCheck = await checkRequirementsFromData(data);
    return { requirementsCheck, interactiveData: data };
  };

  /**
   * Find and attach event listeners to interactive elements in the DOM
   * This replaces the need for inline onclick handlers
   */
  const attachInteractiveEventListeners = useCallback(() => {
    // Find all interactive elements with data attributes in the scoped container
    const searchContainer = containerRef?.current || document;
    const interactiveElements = searchContainer.querySelectorAll('[data-targetaction][data-reftarget].interactive-button');
    
    interactiveElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      
      // Skip if already has event listener attached
      if (htmlElement.hasAttribute('data-listener-attached')) {
        return;
      }
      
      // Mark as having listener attached
      htmlElement.setAttribute('data-listener-attached', 'true');
      
      // Extract interactive data
      const data = extractInteractiveDataFromElement(htmlElement);
      const buttonType = htmlElement.getAttribute('data-button-type') || 'do';
      
      // Create click handler
      const clickHandler = async (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        
        try {
          // Check requirements before executing
          const requirementsCheck = await checkRequirementsFromData(data);
          
          if (!requirementsCheck.pass) {
            console.warn("Requirements not met for interactive element:", data);
            console.warn("Requirements check results:", requirementsCheck);
            return;
          }
          
          // Execute the appropriate action based on button type and target action
          const isShowMode = buttonType === 'show';
          
          if (data.targetaction === 'highlight') {
            interactiveFocus(data, !isShowMode, htmlElement); // Show mode = don't click, Do mode = click
          } else if (data.targetaction === 'button') {
            interactiveButton(data, !isShowMode, htmlElement); // Show mode = don't click, Do mode = click
          } else if (data.targetaction === 'formfill') {
            interactiveFormFill(data, !isShowMode, htmlElement); // Show mode = don't fill, Do mode = fill
          } else if (data.targetaction === 'navigate') {
            interactiveNavigate(data, !isShowMode, htmlElement); // Show mode = show target, Do mode = navigate
          } else if (data.targetaction === 'sequence') {
            await interactiveSequence(data, isShowMode, htmlElement); // Show mode = highlight only, Do mode = full sequence
          } else {
            console.warn("Unknown target action:", data.targetaction);
          }
        } catch (error) {
          console.error("Error in interactive element click handler:", error);
        }
      };
      
      // Attach click listener
      htmlElement.addEventListener('click', clickHandler);
      
      // Store the handler so we can remove it later if needed
      (htmlElement as any).__interactiveClickHandler = clickHandler;
    });
  }, [interactiveFocus, interactiveButton, interactiveFormFill, interactiveNavigate, interactiveSequence, checkRequirementsFromData, containerRef]);

  /**
   * Remove event listeners from interactive elements
   */
  const detachInteractiveEventListeners = useCallback(() => {
    const searchContainer = containerRef?.current || document;
    const interactiveElements = searchContainer.querySelectorAll('[data-listener-attached="true"]');
    
    interactiveElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      const handler = (htmlElement as any).__interactiveClickHandler;
      
      if (handler) {
        htmlElement.removeEventListener('click', handler);
        delete (htmlElement as any).__interactiveClickHandler;
      }
      
      htmlElement.removeAttribute('data-listener-attached');
    });
  }, [containerRef]);

  /**
   * Check if a DOM node contains interactive elements
   * More explicit and performant than querySelector
   */
  const nodeContainsInteractiveElements = useCallback((node: Node): boolean => {
    // Only check Element nodes
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    
    const element = node as Element;
    
    // Check if the element itself is an interactive button
    if (element.classList.contains('interactive-button') && 
        element.hasAttribute('data-targetaction') && 
        element.hasAttribute('data-reftarget')) {
      return true;
    }
    
    // Check if any child elements are interactive buttons
    // Use getElementsByClassName for better performance than querySelector
    const interactiveElements = element.getElementsByClassName('interactive-button');
    
    for (let i = 0; i < interactiveElements.length; i++) {
      const interactiveElement = interactiveElements[i];
      if (interactiveElement.hasAttribute('data-targetaction') && 
          interactiveElement.hasAttribute('data-reftarget')) {
        return true;
      }
    }
    
    return false;
  }, []);

  // Effect to attach/detach event listeners when DOM changes
  useEffect(() => {
    // Attach event listeners to existing interactive elements
    attachInteractiveEventListeners();
    
    // Set up mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
      let shouldReattach = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain interactive elements
          mutation.addedNodes.forEach((node) => {
            if (nodeContainsInteractiveElements(node)) {
              shouldReattach = true;
            }
          });
        }
      });
      
      if (shouldReattach) {
        // Small delay to let DOM settle
        setTimeout(() => {
          attachInteractiveEventListeners();
        }, 100);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Cleanup function
    return () => {
      observer.disconnect();
      detachInteractiveEventListeners();
    };
  }, [attachInteractiveEventListeners, detachInteractiveEventListeners, nodeContainsInteractiveElements]);

  // Legacy custom event system removed - all interactions now handled by modern direct click handlers

  return {
    interactiveFocus,
    interactiveButton,
    interactiveSequence,
    interactiveFormFill,
    interactiveNavigate,
    checkElementRequirements,
    checkRequirementsFromData,
    checkRequirementsWithData,
    attachInteractiveEventListeners,
    detachInteractiveEventListeners,
  };
} 

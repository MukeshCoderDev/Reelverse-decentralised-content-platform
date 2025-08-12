import { EventEmitter } from 'events';

export interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: AccessibilityNode[];
}

export interface AccessibilityNode {
  target: string[];
  html: string;
  failureSummary: string;
  element: string;
}

export interface AccessibilityTestResult {
  url: string;
  timestamp: Date;
  violations: AccessibilityViolation[];
  passes: AccessibilityRule[];
  incomplete: AccessibilityRule[];
  inapplicable: AccessibilityRule[];
  testEngine: {
    name: string;
    version: string;
  };
}

export interface AccessibilityRule {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
}

export interface AccessibilityConfig {
  rules: Record<string, { enabled: boolean; }>;
  tags: string[];
  locale: string;
  axeVersion: string;
}

export class AccessibilityTestService extends EventEmitter {
  private config: AccessibilityConfig;
  private testResults: Map<string, AccessibilityTestResult> = new Map();

  constructor(config: AccessibilityConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize axe-core or similar accessibility testing library
    this.emit('initialized');
  }

  async testPage(url: string, options: any = {}): Promise<AccessibilityTestResult> {
    this.emit('testStarted', { url });

    try {
      // Mock accessibility test execution
      // In a real implementation, this would use axe-core
      const result = await this.runAccessibilityTest(url, options);
      
      this.testResults.set(url, result);
      this.emit('testCompleted', { url, result });
      
      return result;
    } catch (error) {
      this.emit('testFailed', { url, error });
      throw error;
    }
  }

  async testMultiplePages(urls: string[], options: any = {}): Promise<AccessibilityTestResult[]> {
    const results: AccessibilityTestResult[] = [];
    
    for (const url of urls) {
      try {
        const result = await this.testPage(url, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to test ${url}:`, error);
      }
    }
    
    return results;
  }

  private async runAccessibilityTest(url: string, options: any): Promise<AccessibilityTestResult> {
    // Mock implementation - in reality this would use axe-core
    const violations = this.generateMockViolations();
    const passes = this.generateMockPasses();
    
    return {
      url,
      timestamp: new Date(),
      violations,
      passes,
      incomplete: [],
      inapplicable: [],
      testEngine: {
        name: 'axe-core',
        version: '4.7.0'
      }
    };
  }

  private generateMockViolations(): AccessibilityViolation[] {
    const possibleViolations = [
      {
        id: 'color-contrast',
        impact: 'serious' as const,
        tags: ['wcag2aa', 'wcag143'],
        description: 'Elements must have sufficient color contrast',
        help: 'Ensure the contrast ratio of text and background colors meets WCAG 2 AA contrast ratio thresholds',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
        nodes: [
          {
            target: ['.text-gray-400'],
            html: '<span class="text-gray-400">Low contrast text</span>',
            failureSummary: 'Fix any of the following: Element has insufficient color contrast of 2.85 (foreground color: #9ca3af, background color: #ffffff, font size: 14.0pt (18.6667px), font weight: normal). Expected contrast ratio of 4.5:1',
            element: 'span'
          }
        ]
      },
      {
        id: 'button-name',
        impact: 'critical' as const,
        tags: ['wcag2a', 'wcag412', 'section508'],
        description: 'Buttons must have discernible text',
        help: 'Ensure buttons have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/button-name',
        nodes: [
          {
            target: ['button[aria-label=\"\"]'],
            html: '<button aria-label=\"\" class=\"icon-button\"><svg>...</svg></button>',
            failureSummary: 'Fix any of the following: Element does not have inner text that is visible to screen readers, aria-label attribute does not exist or is empty, aria-labelledby attribute does not exist, references elements that do not exist or that are empty, Element has no title attribute',
            element: 'button'
          }
        ]
      },
      {
        id: 'image-alt',
        impact: 'critical' as const,
        tags: ['wcag2a', 'wcag111', 'section508'],
        description: 'Images must have alternate text',
        help: 'Ensure <img> elements have alternate text or a role of none or presentation',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
        nodes: [
          {
            target: ['img[src=\"/avatar.jpg\"]'],
            html: '<img src=\"/avatar.jpg\" class=\"w-10 h-10 rounded-full\">',
            failureSummary: 'Fix any of the following: Element does not have an alt attribute, aria-label attribute does not exist or is empty, aria-labelledby attribute does not exist, references elements that do not exist or that are empty, Element has no title attribute, Element\'s default semantics were not overridden with role=\"none\" or role=\"presentation\"',
            element: 'img'
          }
        ]
      },
      {
        id: 'heading-order',
        impact: 'moderate' as const,
        tags: ['best-practice'],
        description: 'Heading levels should only increase by one',
        help: 'Ensure headings are in a logical order',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/heading-order',
        nodes: [
          {
            target: ['h4'],
            html: '<h4>Subsection Title</h4>',
            failureSummary: 'Fix any of the following: Heading order invalid',
            element: 'h4'
          }
        ]
      }
    ];

    // Randomly return 0-2 violations for demo purposes
    const numViolations = Math.floor(Math.random() * 3);
    return possibleViolations.slice(0, numViolations);
  }

  private generateMockPasses(): AccessibilityRule[] {
    return [
      {
        id: 'aria-allowed-attr',
        description: 'Elements must only use allowed ARIA attributes',
        help: 'Ensure ARIA attributes are allowed for an element\'s role',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/aria-allowed-attr',
        tags: ['wcag2a', 'wcag412']
      },
      {
        id: 'aria-hidden-body',
        description: 'Ensure aria-hidden=\'true\' is not present on the document body',
        help: 'Ensure aria-hidden=\'true\' is not present on the document body',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/aria-hidden-body',
        tags: ['wcag2a', 'wcag412']
      },
      {
        id: 'aria-hidden-focus',
        description: 'Elements with aria-hidden=true must not be focusable',
        help: 'Ensure aria-hidden elements are not focusable nor contain focusable elements',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/aria-hidden-focus',
        tags: ['wcag2a', 'wcag412', 'wcag131']
      },
      {
        id: 'aria-input-field-name',
        description: 'Input fields must have accessible names',
        help: 'Ensure every ARIA input field has an accessible name',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/aria-input-field-name',
        tags: ['wcag2a', 'wcag412']
      },
      {
        id: 'aria-required-attr',
        description: 'Required ARIA attributes must be provided',
        help: 'Ensure elements with ARIA roles have required ARIA attributes',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/aria-required-attr',
        tags: ['wcag2a', 'wcag412']
      }
    ];
  }

  async generateReport(results: AccessibilityTestResult[]): Promise<AccessibilityReport> {
    const totalViolations = results.reduce((sum, result) => sum + result.violations.length, 0);
    const criticalViolations = results.reduce((sum, result) => 
      sum + result.violations.filter(v => v.impact === 'critical').length, 0);
    const seriousViolations = results.reduce((sum, result) => 
      sum + result.violations.filter(v => v.impact === 'serious').length, 0);
    const moderateViolations = results.reduce((sum, result) => 
      sum + result.violations.filter(v => v.impact === 'moderate').length, 0);
    const minorViolations = results.reduce((sum, result) => 
      sum + result.violations.filter(v => v.impact === 'minor').length, 0);

    const violationsByRule = new Map<string, number>();
    results.forEach(result => {
      result.violations.forEach(violation => {
        violationsByRule.set(violation.id, (violationsByRule.get(violation.id) || 0) + 1);
      });
    });

    const complianceScore = this.calculateComplianceScore(results);

    return {
      summary: {
        totalPages: results.length,
        totalViolations,
        criticalViolations,
        seriousViolations,
        moderateViolations,
        minorViolations,
        complianceScore
      },
      results,
      violationsByRule: Array.from(violationsByRule.entries()).map(([rule, count]) => ({
        rule,
        count,
        percentage: (count / results.length) * 100
      })),
      recommendations: this.generateRecommendations(results),
      generatedAt: new Date()
    };
  }

  private calculateComplianceScore(results: AccessibilityTestResult[]): number {
    if (results.length === 0) return 100;

    const totalChecks = results.reduce((sum, result) => 
      sum + result.violations.length + result.passes.length, 0);
    
    if (totalChecks === 0) return 100;

    const passedChecks = results.reduce((sum, result) => sum + result.passes.length, 0);
    return Math.round((passedChecks / totalChecks) * 100);
  }

  private generateRecommendations(results: AccessibilityTestResult[]): AccessibilityRecommendation[] {
    const recommendations: AccessibilityRecommendation[] = [];
    const violationCounts = new Map<string, number>();

    // Count violations by type
    results.forEach(result => {
      result.violations.forEach(violation => {
        violationCounts.set(violation.id, (violationCounts.get(violation.id) || 0) + 1);
      });
    });

    // Generate recommendations based on most common violations
    const sortedViolations = Array.from(violationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    sortedViolations.forEach(([violationId, count]) => {
      const recommendation = this.getRecommendationForViolation(violationId, count);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });

    return recommendations;
  }

  private getRecommendationForViolation(violationId: string, count: number): AccessibilityRecommendation | null {
    const recommendations: Record<string, AccessibilityRecommendation> = {
      'color-contrast': {
        priority: 'high',
        title: 'Improve Color Contrast',
        description: `${count} elements have insufficient color contrast. Ensure text meets WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text).`,
        action: 'Review and update color schemes to meet contrast requirements',
        impact: 'Users with visual impairments may have difficulty reading content'
      },
      'button-name': {
        priority: 'critical',
        title: 'Add Button Labels',
        description: `${count} buttons lack accessible names. All interactive elements must have descriptive labels.`,
        action: 'Add aria-label, aria-labelledby, or visible text to all buttons',
        impact: 'Screen reader users cannot understand button functionality'
      },
      'image-alt': {
        priority: 'critical',
        title: 'Add Image Alt Text',
        description: `${count} images are missing alternative text. All informative images must have descriptive alt attributes.`,
        action: 'Add meaningful alt text to all images, or mark decorative images with alt=""',
        impact: 'Screen reader users cannot access image content'
      },
      'heading-order': {
        priority: 'medium',
        title: 'Fix Heading Structure',
        description: `${count} headings are not in logical order. Headings should follow a hierarchical structure.`,
        action: 'Reorganize headings to follow proper nesting (h1 > h2 > h3, etc.)',
        impact: 'Users navigating by headings may become confused about page structure'
      }
    };

    return recommendations[violationId] || null;
  }

  async testComponent(componentHtml: string, options: any = {}): Promise<AccessibilityTestResult> {
    // Mock component testing
    return this.runAccessibilityTest('component-test', options);
  }

  async continuousMonitoring(urls: string[], interval: number = 24 * 60 * 60 * 1000): Promise<void> {
    const runTests = async () => {
      try {
        const results = await this.testMultiplePages(urls);
        const report = await this.generateReport(results);
        this.emit('monitoringReport', report);
      } catch (error) {
        this.emit('monitoringError', error);
      }
    };

    // Run initial test
    await runTests();

    // Schedule recurring tests
    setInterval(runTests, interval);
  }

  getTestResults(): AccessibilityTestResult[] {
    return Array.from(this.testResults.values());
  }

  getTestResult(url: string): AccessibilityTestResult | null {
    return this.testResults.get(url) || null;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        testResults: this.testResults.size,
        configuredRules: Object.keys(this.config.rules).length
      }
    };
  }
}

export interface AccessibilityReport {
  summary: {
    totalPages: number;
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
    complianceScore: number;
  };
  results: AccessibilityTestResult[];
  violationsByRule: {
    rule: string;
    count: number;
    percentage: number;
  }[];
  recommendations: AccessibilityRecommendation[];
  generatedAt: Date;
}

export interface AccessibilityRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: string;
}
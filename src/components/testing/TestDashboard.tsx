import React, { useState, useEffect } from 'react';
import { TestOrchestrator, TestSuite, TestRunResult } from '../../testing/TestOrchestrator';

interface TestDashboardProps {
  orchestrator: TestOrchestrator;
}

export const TestDashboard: React.FC<TestDashboardProps> = ({ orchestrator }) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [testResults, setTestResults] = useState<TestRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestRunResult | null>(null);

  useEffect(() => {
    loadTestSuites();
    loadTestResults();
    setupEventListeners();

    return () => {
      orchestrator.removeAllListeners();
    };
  }, [orchestrator]);

  const loadTestSuites = () => {
    const suites = orchestrator.getTestSuites();
    setTestSuites(suites);
  };

  const loadTestResults = () => {
    const results = orchestrator.getTestResults();
    setTestResults(results);
  };

  const setupEventListeners = () => {
    orchestrator.on('testRunStarted', (data) => {
      setIsRunning(true);
      setCurrentRun(null);
    });

    orchestrator.on('testRunCompleted', (result) => {
      setIsRunning(false);
      setCurrentRun(result);
      setTestResults(prev => [result, ...prev]);
    });

    orchestrator.on('testRunFailed', (data) => {
      setIsRunning(false);
    });
  };

  const handleRunAllTests = async () => {
    try {
      await orchestrator.runAllTests();
    } catch (error) {
      console.error('Test run failed:', error);
    }
  };

  const handleRunTestSuite = async (suiteId: string) => {
    try {
      await orchestrator.runTestSuite(suiteId);
      loadTestSuites();
    } catch (error) {
      console.error('Test suite run failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'running': return 'text-blue-600';
      case 'pending': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Dashboard</h1>
        <p className="text-gray-600">Comprehensive testing and quality assurance</p>
      </div>

      {/* Test Run Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Test Execution</h2>
          <button
            onClick={handleRunAllTests}
            disabled={isRunning}
            className={`px-6 py-2 rounded-lg font-medium ${
              isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </button>
        </div>

        {isRunning && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Tests are running...</span>
            </div>
          </div>
        )}

        {currentRun && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Latest Test Run Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{currentRun.totalTests}</div>
                <div className="text-sm text-gray-600">Total Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{currentRun.passedTests}</div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{currentRun.failedTests}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {currentRun.coverage?.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Coverage</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Suites */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Suites</h2>
        <div className="space-y-4">
          {testSuites.map((suite) => (
            <div key={suite.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getStatusIcon(suite.status)}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">{suite.name}</h3>
                    <p className="text-sm text-gray-600">
                      {suite.type} • {suite.tests.length} tests
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRunTestSuite(suite.id)}
                  disabled={isRunning}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    isRunning
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Run Suite
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <div className="text-sm">
                  <span className="text-gray-600">Status: </span>
                  <span className={`font-medium ${getStatusColor(suite.status)}`}>
                    {suite.status}
                  </span>
                </div>
                {suite.duration && (
                  <div className="text-sm">
                    <span className="text-gray-600">Duration: </span>
                    <span className="font-medium">{suite.duration}ms</span>
                  </div>
                )}
                {suite.coverage && (
                  <div className="text-sm">
                    <span className="text-gray-600">Coverage: </span>
                    <span className="font-medium">{suite.coverage.percentage.toFixed(1)}%</span>
                  </div>
                )}
              </div>

              {/* Test Details */}
              <div className="mt-4 space-y-2">
                {suite.tests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{getStatusIcon(test.status)}</span>
                      <span className="text-sm font-medium text-gray-900">{test.name}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      {test.duration && <span>{test.duration}ms</span>}
                      <span>{test.assertions.length} assertions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test History</h2>
        {testResults.length === 0 ? (
          <p className="text-gray-600">No test runs yet. Run tests to see results here.</p>
        ) : (
          <div className="space-y-4">
            {testResults.slice(0, 10).map((result) => (
              <div key={result.runId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">Test Run {result.runId}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date().toLocaleString()} • {result.duration}ms
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {result.passedTests}/{result.totalTests} passed
                    </div>
                    <div className="text-xs text-gray-600">
                      {result.coverage.percentage.toFixed(1)}% coverage
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Total: </span>
                    <span className="font-medium">{result.totalTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Passed: </span>
                    <span className="font-medium text-green-600">{result.passedTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed: </span>
                    <span className="font-medium text-red-600">{result.failedTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Skipped: </span>
                    <span className="font-medium text-yellow-600">{result.skippedTests}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
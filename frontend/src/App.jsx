import React, { useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const severityLabels = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const groupedIssues = useMemo(() => {
    if (!report?.issues) {
      return {};
    }

    return report.issues.reduce((groups, issue) => {
      groups[issue.severity] = groups[issue.severity] || [];
      groups[issue.severity].push(issue);
      return groups;
    }, {});
  }, [report]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setReport(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ repoUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }

      setReport(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <h1>Code Health Checker</h1>
          <p>Analyze a public GitHub repository for risky patterns and missing quality signals.</p>
        </div>

        <form className="repo-form" onSubmit={handleSubmit}>
          <label htmlFor="repoUrl">GitHub repository URL</label>
          <div className="input-row">
            <input
              id="repoUrl"
              type="url"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              required
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </form>
      </section>

      {error && <div className="alert">{error}</div>}

      {report && (
        <section className="report">
          <div className="report-header">
            <div>
              <h2>{report.repository}</h2>
              <p>
                {report.summary.filesScanned} files scanned on {report.defaultBranch}
              </p>
            </div>
            <div className="score">
              <span>{report.summary.totalIssues}</span>
              <small>issues</small>
            </div>
          </div>

          <div className="summary-grid">
            <SummaryCard label="High" value={report.summary.high} severity="HIGH" />
            <SummaryCard label="Medium" value={report.summary.medium} severity="MEDIUM" />
            <SummaryCard label="Low" value={report.summary.low} severity="LOW" />
          </div>

          {report.issues.length === 0 ? (
            <div className="empty-state">No issues found in scanned files.</div>
          ) : (
            <div className="issue-groups">
              {['HIGH', 'MEDIUM', 'LOW'].map((severity) => (
                <IssueGroup
                  key={severity}
                  severity={severity}
                  issues={groupedIssues[severity] || []}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value, severity }) {
  return (
    <div className={`summary-card severity-${severity.toLowerCase()}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IssueGroup({ severity, issues }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="issue-group">
      <h3>
        <span className={`severity-dot severity-${severity.toLowerCase()}`} />
        {severityLabels[severity]} severity
      </h3>

      <div className="issue-list">
        {issues.map((issue, index) => (
          <article className="issue-card" key={`${issue.type}-${issue.file}-${issue.line}-${index}`}>
            <div className="issue-topline">
              <span className={`badge severity-${issue.severity.toLowerCase()}`}>
                {issue.severity}
              </span>
              <strong>{issue.type}</strong>
            </div>
            <p>{issue.message}</p>
            <code>
              {issue.file || 'Repository'} {issue.line ? `:${issue.line}` : ''}
            </code>
          </article>
        ))}
      </div>
    </section>
  );
}

export default App;

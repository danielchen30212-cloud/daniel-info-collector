import React, { useState, useEffect } from 'react';
import './InformationCollectorApp.css';

export default function InformationCollectorApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    sources: [],
    keywords: [],
    dateRange: 'week'
  });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchArticles();
    fetchStats();
  }, [filters]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sources.length > 0) {
        params.append('sources', filters.sources.join(','));
      }
      if (filters.keywords.length > 0) {
        params.append('keywords', filters.keywords.join(','));
      }
      params.append('dateRange', filters.dateRange);

      const response = await fetch(`/api/articles?${params}`);
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSourceToggle = (source) => {
    setFilters(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source]
    }));
  };

  const handleKeywordToggle = (keyword) => {
    setFilters(prev => ({
      ...prev,
      keywords: prev.keywords.includes(keyword)
        ? prev.keywords.filter(k => k !== keyword)
        : [...prev.keywords, keyword]
    }));
  };

  const handleSaveArticle = async (articleId) => {
    try {
      const response = await fetch(`/api/articles/${articleId}/save`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Article saved successfully!');
        fetchArticles();
      }
    } catch (error) {
      console.error('Error saving article:', error);
    }
  };

  const sources = ['kpmg', 'pwc', 'ey', 'deloitte', 'bbc', 'cnn', 'cgtn', 'business', 'times', 'bloomberg'];
  const keywords = ['Taiwan', 'China', 'Technology', 'AI', 'Supply Chain'];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Daniel 亞太區信息收集平台</h1>
        <p className="subtitle">Asia-Pacific Information Collection Platform</p>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="filter-section">
            <h3>📊 統計信息</h3>
            {stats && (
              <div className="stats-box">
                <p><strong>總文章:</strong> {stats.totalArticles}</p>
                <p><strong>信息源:</strong> {stats.sources}</p>
                <p><strong>關鍵詞:</strong> {stats.keywords}</p>
              </div>
            )}
          </div>

          <div className="filter-section">
            <h3>🌍 信息源</h3>
            <div className="source-filters">
              {sources.map(source => (
                <label key={source} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.sources.includes(source)}
                    onChange={() => handleSourceToggle(source)}
                  />
                  <span>{source.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h3>🔑 關鍵詞</h3>
            <div className="keyword-filters">
              {keywords.map(keyword => (
                <label key={keyword} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.keywords.includes(keyword)}
                    onChange={() => handleKeywordToggle(keyword)}
                  />
                  <span>{keyword}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h3>📅 日期範圍</h3>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="date-select"
            >
              <option value="day">最近 24 小時</option>
              <option value="week">最近一週</option>
              <option value="month">最近一月</option>
            </select>
          </div>
        </aside>

        <main className="main-content">
          {loading && <div className="loading">加載中...</div>}

          {!loading && articles.length === 0 && (
            <div className="no-articles">
              <p>😕 沒有找到符合條件的文章</p>
              <p className="hint">請嘗試調整篩選條件</p>
            </div>
          )}

          <div className="articles-grid">
            {articles.map((article) => (
              <article key={article._id} className="article-card">
                <div className="article-header">
                  <h2 className="article-title">{article.title}</h2>
                  <span className="article-source">{article.source}</span>
                </div>

                <div className="article-meta">
                  <span className="article-date">
                    📅 {new Date(article.date).toLocaleDateString('zh-TW')}
                  </span>
                  {article.country && (
                    <span className="article-country">🌏 {article.country}</span>
                  )}
                </div>

                <p className="article-excerpt">{article.excerpt}</p>

                {article.keywords && article.keywords.length > 0 && (
                  <div className="article-keywords">
                    {article.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag">{keyword}</span>
                    ))}
                  </div>
                )}

                <div className="article-actions">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-read">
                    閱讀全文 →
                  </a>
                  <button
                    onClick={() => handleSaveArticle(article._id)}
                    className="btn-save"
                  >
                    ⭐ 保存
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <p>Last updated: {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('zh-TW') : 'Never'}</p>
      </footer>
    </div>
  );
}

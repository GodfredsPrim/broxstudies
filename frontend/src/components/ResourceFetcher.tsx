import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Book, Globe, Search, BookOpen, ExternalLink, Library, User, Filter } from 'lucide-react';
import '../styles/ResourceFetcher.css';

interface WikipediaResult {
  title: string;
  snippet: string;
  pageid: number;
}

interface OpenLibraryResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
}

interface GoogleBooksResult {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail: string;
    };
    infoLink: string;
  };
}

export const ResourceFetcher: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'books' | 'articles' | 'ghana_books'>('books');

  // --- WEB ARTICLES STATE (WIKIPEDIA) ---
  const [articleQuery, setArticleQuery] = useState('');
  const [articleResults, setArticleResults] = useState<WikipediaResult[]>([]);
  const [isSearchingArticles, setIsSearchingArticles] = useState(false);

  // --- E-LIBRARY BOOKS STATE (OPEN LIBRARY) ---
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<OpenLibraryResult[]>([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);

  // --- GHANA BOOKS & LIFESTYLE STATE (GOOGLE BOOKS) ---
  const [ghanaQuery, setGhanaQuery] = useState('Ghanaian Literature');
  const [ghanaResults, setGhanaResults] = useState<GoogleBooksResult[]>([]);
  const [isSearchingGhana, setIsSearchingGhana] = useState(false);
  const [ghanaError, setGhanaError] = useState('');

  const CURATED_CATEGORIES = [
    { label: '🇬🇭 Popular Ghana Books', query: '"The Beautyful Ones Are Not Yet Born" OR "Homegoing" OR "Ayi Kwei Armah" OR "Yaa Gyasi" OR "Ama Ata Aidoo"' },
    { label: '💰 Wealth & Business', query: 'Financial independence and business success books' },
    { label: '🧠 Major Topics', query: 'Artificial Intelligence, Climate Change, World History, Philosophy' },
    { label: '🌱 Self-Improvement', query: 'Best selling self help and motivation books' },
    { label: '🌍 African Classics', query: 'Things Fall Apart, Half of a Yellow Sun, African Literature' }
  ];

  const [error, setError] = useState<string>('');

  // --- WEB ARTICLES HANDLERS ---
  const searchArticles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleQuery.trim()) return;
    setIsSearchingArticles(true);
    try {
      const response = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(articleQuery)}&utf8=&format=json&origin=*`);
      setArticleResults(response.data.query.search);
    } catch (err) {
      setError('Failed to fetch articles. Please check your internet connection.');
    } finally {
      setIsSearchingArticles(false);
    }
  };

  // --- E-LIBRARY HANDLERS ---
  const searchBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookQuery.trim()) return;
    setIsSearchingBooks(true);
    try {
      const response = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(bookQuery)}&limit=20`);
      setBookResults(response.data.docs);
    } catch (err) {
      setError('Failed to fetch books. Please try again.');
    } finally {
      setIsSearchingBooks(false);
    }
  };

  // --- GHANA BOOKS & LIFESTYLE HANDLERS ---
  const searchGhanaBooks = async (queryToSearch: string = ghanaQuery) => {
    if (!queryToSearch.trim()) return;
    setIsSearchingGhana(true);
    setGhanaError('');
    try {
      // Using public Google Books API
      const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryToSearch)}&maxResults=20`);
      setGhanaResults(response.data.items || []);
    } catch (err) {
      setGhanaError('Failed to fetch premium curated books. Please try again.');
    } finally {
      setIsSearchingGhana(false);
    }
  };

  // Preload Ghana books on first mount of that tab
  useEffect(() => {
    if (activeTab === 'ghana_books' && ghanaResults.length === 0) {
      searchGhanaBooks(CURATED_CATEGORIES[0].query);
    }
  }, [activeTab]);

  return (
    <div className="generator-shell">
      
      {/* ── HEADER & NAVIGATION ── */}
      <div className="generator-header">
        <div className="generator-header__content">
          <h2 className="generator-title">Interactive Library</h2>
          <p className="generator-subtitle">
            Explore free story books, reference articles, and self-development materials.
          </p>
        </div>

        <div className="flex gap-2">
          <button 
            className={`generator-btn ${activeTab === 'books' ? 'generator-btn--primary' : 'generator-btn--secondary'}`}
            onClick={() => setActiveTab('books')}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}
          >
            <BookOpen size={16} /> E-Books
          </button>
          <button 
            className={`generator-btn ${activeTab === 'articles' ? 'generator-btn--primary' : 'generator-btn--secondary'}`}
            onClick={() => setActiveTab('articles')}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}
          >
            <Globe size={16} /> Articles
          </button>
          <button 
            className={`generator-btn ${activeTab === 'ghana_books' ? 'generator-btn--primary' : 'generator-btn--secondary'}`}
            onClick={() => setActiveTab('ghana_books')}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}
          >
            <Library size={16} /> Authors
          </button>
        </div>
      </div>

      {error && activeTab !== 'ghana_books' && (
        <div className="resource-fetcher__error" style={{ marginBottom: '20px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── TAB: GHANA AUTHORS & LIFESTYLE ── */}
      {activeTab === 'ghana_books' && (
        <div className="animate-fade-in">
          <div className="mb-8 p-6 glass-card">
            <div className="flex items-center gap-2 mb-4 text-ghana-green">
              <Filter size={18} />
              <span className="font-bold text-sm uppercase tracking-wider">Curated Categories</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CURATED_CATEGORIES.map(cat => (
                <button 
                  key={cat.label}
                  onClick={() => { setGhanaQuery(cat.label); searchGhanaBooks(cat.query); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    ghanaQuery === cat.label 
                    ? 'bg-ghana-green text-white border-ghana-green' 
                    : 'bg-white/50 text-gray-600 border-gray-100 hover:bg-white hover:border-ghana-green/30'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); searchGhanaBooks(); }} className="flex gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input 
                type="text" 
                placeholder="Search entrepreneurship, health, or lifestyle books..." 
                value={ghanaQuery}
                onChange={(e) => setGhanaQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-ghana-green focus:ring-4 focus:ring-ghana-green/10 outline-none transition-all text-lg"
              />
            </div>
            <button type="submit" className="generator-btn generator-btn--primary px-8" disabled={isSearchingGhana}>
              {isSearchingGhana ? 'Searching...' : 'Search'}
            </button>
          </form>

          {ghanaError && <div className="error-message">⚠️ {ghanaError}</div>}

          {ghanaResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {ghanaResults.map((book) => {
                const info = book.volumeInfo;
                return (
                  <div 
                    key={book.id} 
                    className="group glass-card overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
                    onClick={() => window.open(info.infoLink, '_blank')}
                  >
                    <div className="h-64 bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {info.imageLinks?.thumbnail ? (
                        <img src={info.imageLinks.thumbnail} alt={info.title} className="max-h-full max-w-full object-contain shadow-lg transform group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center gap-2">
                          <Book size={48} strokeWidth={1} />
                          <span className="text-xs uppercase font-bold tracking-widest">No Cover</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-bold text-lg leading-tight mb-2 text-gray-900 group-hover:text-ghana-green transition-colors line-clamp-2">{info.title}</h4>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-1 flex items-center gap-1">
                        <User size={12} /> {info.authors ? info.authors.join(', ') : 'Unknown Author'}
                      </p>
                      <button className="mt-auto w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-ghana-green transition-colors">
                        View Book <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !isSearchingGhana && <div className="text-center py-20 text-muted-foreground italic">No books found for this topic.</div>
          )}
        </div>
      )}

      {/* ── TAB: FREE E-BOOKS ── */}
      {activeTab === 'books' && (
        <div className="animate-fade-in">
          <form onSubmit={searchBooks} className="flex gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input 
                type="text" 
                placeholder="Search for story books, novels, reading materials (e.g. Oliver Twist)..." 
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-ghana-green focus:ring-4 focus:ring-ghana-green/10 outline-none transition-all text-lg"
              />
            </div>
            <button type="submit" className="generator-btn generator-btn--primary px-8" disabled={isSearchingBooks}>
              {isSearchingBooks ? 'Searching...' : 'Search'}
            </button>
          </form>

          {bookResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {bookResults.map((book, idx) => (
                <div 
                  key={idx} 
                  className="group glass-card overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
                  onClick={() => window.open(`https://openlibrary.org${book.key}`, '_blank')}
                >
                  <div className="h-72 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {book.cover_i ? (
                      <img src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`} alt={book.title} className="max-h-full max-w-full object-contain shadow-lg transform group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="text-gray-300 flex flex-col items-center gap-2">
                        <BookOpen size={48} strokeWidth={1} />
                        <span className="text-xs uppercase font-bold tracking-widest">No Cover</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h4 className="font-bold text-lg leading-tight mb-2 text-gray-900 group-hover:text-ghana-green transition-colors line-clamp-2">{book.title}</h4>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-1 flex items-center gap-1">
                      <User size={12} /> {book.author_name ? book.author_name[0] : 'Unknown Author'}
                    </p>
                    <button className="mt-auto w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-ghana-green transition-colors">
                      Read Online <BookOpen size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: WEB ARTICLES ── */}
      {activeTab === 'articles' && (
        <div className="animate-fade-in">
          <form onSubmit={searchArticles} className="flex gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input 
                type="text" 
                placeholder="Research any topic (e.g. Quantum Mechanics, History of Ghana)..." 
                value={articleQuery}
                onChange={(e) => setArticleQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-ghana-green focus:ring-4 focus:ring-ghana-green/10 outline-none transition-all text-lg"
              />
            </div>
            <button type="submit" className="generator-btn generator-btn--primary px-8" disabled={isSearchingArticles}>
              {isSearchingArticles ? 'Searching...' : 'Search'}
            </button>
          </form>

          {articleResults.length > 0 && (
            <div className="space-y-6">
              {articleResults.map((article) => (
                <div key={article.pageid} className="glass-card p-6 hover:shadow-xl transition-shadow group">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-ghana-green transition-colors">{article.title}</h3>
                  <p 
                    dangerouslySetInnerHTML={{ __html: article.snippet + '...' }} 
                    className="text-gray-600 leading-relaxed mb-6"
                  />
                  <a 
                    href={`https://en.wikipedia.org/?curid=${article.pageid}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-ghana-green hover:text-white hover:border-ghana-green transition-all"
                  >
                    Read Full Article <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResourceFetcher;

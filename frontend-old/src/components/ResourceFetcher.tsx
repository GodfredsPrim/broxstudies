import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Book,
  Globe,
  Search,
  BookOpen,
  ExternalLink,
  Library,
  User,
  Filter,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

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
    imageLinks?: { thumbnail: string };
    infoLink: string;
  };
}

type TabKey = 'books' | 'articles' | 'ghana_books';

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'books', label: 'E-Books', icon: BookOpen },
  { key: 'articles', label: 'Articles', icon: Globe },
  { key: 'ghana_books', label: 'Authors', icon: Library },
];

const CURATED_CATEGORIES = [
  {
    label: 'Popular Ghana Books',
    query:
      '"The Beautyful Ones Are Not Yet Born" OR "Homegoing" OR "Ayi Kwei Armah" OR "Yaa Gyasi" OR "Ama Ata Aidoo"',
  },
  { label: 'Wealth & Business', query: 'Financial independence and business success books' },
  {
    label: 'Major Topics',
    query: 'Artificial Intelligence, Climate Change, World History, Philosophy',
  },
  { label: 'Self-Improvement', query: 'Best selling self help and motivation books' },
  {
    label: 'African Classics',
    query: 'Things Fall Apart, Half of a Yellow Sun, African Literature',
  },
];

function BookCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden border-gh-chalk bg-gh-paper shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised">
      <Skeleton shape="block" className="h-56 w-full rounded-none sm:h-64" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <Skeleton shape="title" className="h-5 w-4/5" />
        <Skeleton shape="text" className="w-2/3" />
        <Skeleton shape="button" className="mt-auto h-10 w-full" />
      </div>
    </Card>
  );
}

function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  loading?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gh-ink-40 dark:text-gh-chalk"
          size={18}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-gh-chalk bg-gh-paper pl-11 pr-4 text-sm font-semibold text-gh-ink outline-none transition-all focus:border-gh-ink-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.12)] dark:border-white/10 dark:bg-white/5 dark:text-gh-cream dark:placeholder:text-gh-chalk/60"
        />
      </div>
      <Button type="submit" size="lg" disabled={loading} className="gap-2 sm:w-auto">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        {loading ? 'Searching…' : 'Search'}
      </Button>
    </form>
  );
}

export const ResourceFetcher: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('books');

  const [articleQuery, setArticleQuery] = useState('');
  const [articleResults, setArticleResults] = useState<WikipediaResult[]>([]);
  const [isSearchingArticles, setIsSearchingArticles] = useState(false);
  const [articleError, setArticleError] = useState('');

  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<OpenLibraryResult[]>([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [bookError, setBookError] = useState('');

  const [ghanaQuery, setGhanaQuery] = useState('Ghanaian Literature');
  const [activeCategory, setActiveCategory] = useState<string>(CURATED_CATEGORIES[0].label);
  const [ghanaResults, setGhanaResults] = useState<GoogleBooksResult[]>([]);
  const [isSearchingGhana, setIsSearchingGhana] = useState(false);
  const [ghanaError, setGhanaError] = useState('');

  const searchArticles = async (query: string = articleQuery) => {
    if (!query.trim()) return;
    setIsSearchingArticles(true);
    setArticleError('');
    try {
      const response = await axios.get(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&utf8=&format=json&origin=*`
      );
      setArticleResults(response.data.query.search);
    } catch {
      setArticleError('Failed to fetch articles. Please check your internet connection.');
    } finally {
      setIsSearchingArticles(false);
    }
  };

  const searchBooks = async (query: string = bookQuery) => {
    if (!query.trim()) return;
    setIsSearchingBooks(true);
    setBookError('');
    try {
      const response = await axios.get(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`
      );
      setBookResults(response.data.docs);
    } catch {
      setBookError('Failed to fetch books. Please try again.');
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const searchGhanaBooks = async (queryToSearch: string = ghanaQuery) => {
    if (!queryToSearch.trim()) return;
    setIsSearchingGhana(true);
    setGhanaError('');
    try {
      const response = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          queryToSearch
        )}&maxResults=20`
      );
      setGhanaResults(response.data.items || []);
    } catch {
      setGhanaError('Failed to fetch curated books. Please try again.');
    } finally {
      setIsSearchingGhana(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ghana_books' && ghanaResults.length === 0) {
      searchGhanaBooks(CURATED_CATEGORIES[0].query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="generator-shell">
      <SectionHeader
        eyebrow="Library"
        title="Interactive Library"
        description="Explore free story books, reference articles, and self-development materials curated for SHS students."
      />

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Resource categories"
        className="flex flex-wrap gap-2 rounded-2xl border border-gh-chalk bg-gh-paper/80 p-1.5 shadow-brand-sm dark:border-white/10 dark:bg-white/5 sm:w-max"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-brand sm:flex-initial ${
                active
                  ? 'bg-gh-ink-blue text-white shadow-brand-sm'
                  : 'text-gh-ink-60 hover:bg-gh-ink-blue-50 hover:text-gh-ink-blue dark:text-gh-chalk dark:hover:bg-white/5 dark:hover:text-gh-cream'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Ghana authors / curated */}
      {activeTab === 'ghana_books' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <Card className="mb-6 border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-gh-ink-blue dark:text-gh-gold-glow">
              <Filter size={16} />
              <span className="text-xs font-black uppercase tracking-widest">
                Curated Categories
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CURATED_CATEGORIES.map((cat) => {
                const active = activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    onClick={() => {
                      setActiveCategory(cat.label);
                      setGhanaQuery(cat.label);
                      searchGhanaBooks(cat.query);
                    }}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 ease-brand sm:text-sm ${
                      active
                        ? 'border-gh-ink-blue bg-gh-ink-blue text-white shadow-brand-sm'
                        : 'border-gh-chalk bg-gh-paper text-gh-ink-60 hover:-translate-y-0.5 hover:border-gh-ink-blue/30 hover:text-gh-ink-blue dark:border-white/10 dark:bg-white/5 dark:text-gh-chalk dark:hover:text-gh-cream'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <SearchBar
            value={ghanaQuery}
            onChange={setGhanaQuery}
            onSubmit={() => searchGhanaBooks()}
            placeholder="Search entrepreneurship, health, or lifestyle books…"
            loading={isSearchingGhana}
          />

          {ghanaError ? (
            <ErrorState
              size="sm"
              title="Couldn't load books"
              description={ghanaError}
              onRetry={() => searchGhanaBooks()}
            />
          ) : isSearchingGhana ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          ) : ghanaResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
              {ghanaResults.map((book) => {
                const info = book.volumeInfo;
                return (
                  <Card
                    key={book.id}
                    onClick={() => window.open(info.infoLink, '_blank', 'noopener,noreferrer')}
                    className="group flex cursor-pointer flex-col overflow-hidden border-gh-chalk bg-gh-paper shadow-brand-sm transition-all duration-300 ease-brand hover:-translate-y-1 hover:border-gh-ink-blue/20 hover:shadow-brand-lg dark:border-white/10 dark:bg-gh-night-raised"
                  >
                    <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gh-ink-blue-50 p-4 dark:bg-white/5 sm:h-64">
                      {info.imageLinks?.thumbnail ? (
                        <img
                          src={info.imageLinks.thumbnail.replace('http:', 'https:')}
                          alt={info.title}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-500 ease-brand group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gh-ink-blue/30 dark:text-gh-gold-glow/30">
                          <Book size={48} strokeWidth={1} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            No Cover
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <h4 className="mb-2 line-clamp-2 text-sm font-extrabold leading-tight tracking-tight text-gh-ink transition-colors group-hover:text-gh-ink-blue dark:text-gh-cream dark:group-hover:text-gh-gold-glow sm:text-base">
                        {info.title}
                      </h4>
                      <p className="mb-4 flex items-center gap-1 truncate text-xs text-gh-ink-40 dark:text-gh-chalk">
                        <User size={12} />
                        {info.authors ? info.authors.join(', ') : 'Unknown Author'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto w-full gap-2"
                        tabIndex={-1}
                      >
                        View Book <ExternalLink size={13} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Library size={28} strokeWidth={1.75} />}
              title="No books found for this topic"
              description="Try a different keyword or pick a curated category above."
            />
          )}
        </div>
      )}

      {/* Free E-Books tab */}
      {activeTab === 'books' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SearchBar
            value={bookQuery}
            onChange={setBookQuery}
            onSubmit={() => searchBooks()}
            placeholder="Search story books, novels, reading materials (e.g. Oliver Twist)…"
            loading={isSearchingBooks}
          />

          {bookError ? (
            <ErrorState
              size="sm"
              title="Couldn't load books"
              description={bookError}
              onRetry={() => searchBooks()}
            />
          ) : isSearchingBooks ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          ) : bookResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
              {bookResults.map((book, idx) => (
                <Card
                  key={`${book.key}-${idx}`}
                  onClick={() =>
                    window.open(`https://openlibrary.org${book.key}`, '_blank', 'noopener,noreferrer')
                  }
                  className="group flex cursor-pointer flex-col overflow-hidden border-gh-chalk bg-gh-paper shadow-brand-sm transition-all duration-300 ease-brand hover:-translate-y-1 hover:border-gh-ink-blue/20 hover:shadow-brand-lg dark:border-white/10 dark:bg-gh-night-raised"
                >
                  <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gh-ink-blue-50 p-4 dark:bg-white/5 sm:h-64">
                    {book.cover_i ? (
                      <img
                        src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                        alt={book.title}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-500 ease-brand group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gh-ink-blue/30 dark:text-gh-gold-glow/30">
                        <BookOpen size={48} strokeWidth={1} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          No Cover
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h4 className="mb-2 line-clamp-2 text-sm font-extrabold leading-tight tracking-tight text-gh-ink transition-colors group-hover:text-gh-ink-blue dark:text-gh-cream dark:group-hover:text-gh-gold-glow sm:text-base">
                      {book.title}
                    </h4>
                    <p className="mb-4 flex items-center gap-1 truncate text-xs text-gh-ink-40 dark:text-gh-chalk">
                      <User size={12} />
                      {book.author_name ? book.author_name[0] : 'Unknown Author'}
                    </p>
                    <Button variant="outline" size="sm" className="mt-auto w-full gap-2" tabIndex={-1}>
                      Read Online <BookOpen size={13} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={28} strokeWidth={1.75} />}
              title="Start a search"
              description="Type a title, author, or subject to browse the Open Library catalogue."
            />
          )}
        </div>
      )}

      {/* Articles tab */}
      {activeTab === 'articles' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SearchBar
            value={articleQuery}
            onChange={setArticleQuery}
            onSubmit={() => searchArticles()}
            placeholder="Research any topic (e.g. Quantum Mechanics, History of Ghana)…"
            loading={isSearchingArticles}
          />

          {articleError ? (
            <ErrorState
              size="sm"
              title="Couldn't load articles"
              description={articleError}
              onRetry={() => searchArticles()}
            />
          ) : isSearchingArticles ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card
                  key={i}
                  className="space-y-3 border-gh-chalk bg-gh-paper p-5 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-6"
                >
                  <Skeleton shape="title" className="h-6 w-2/5" />
                  <Skeleton shape="text" />
                  <Skeleton shape="text" className="w-3/4" />
                  <Skeleton shape="button" className="h-10 w-36" />
                </Card>
              ))}
            </div>
          ) : articleResults.length > 0 ? (
            <div className="space-y-4">
              {articleResults.map((article) => (
                <Card
                  key={article.pageid}
                  className="group border-gh-chalk bg-gh-paper p-5 shadow-brand-sm transition-all duration-300 ease-brand hover:-translate-y-0.5 hover:border-gh-ink-blue/20 hover:shadow-brand-md dark:border-white/10 dark:bg-gh-night-raised sm:p-6"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-lg font-extrabold tracking-tight text-gh-ink transition-colors group-hover:text-gh-ink-blue dark:text-gh-cream dark:group-hover:text-gh-gold-glow sm:text-xl">
                      {article.title}
                    </h3>
                    <Badge variant="blue" size="sm" className="shrink-0 gap-1">
                      <Globe size={11} /> Wikipedia
                    </Badge>
                  </div>
                  <p
                    dangerouslySetInnerHTML={{ __html: article.snippet + '…' }}
                    className="mb-5 text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk"
                  />
                  <a
                    href={`https://en.wikipedia.org/?curid=${article.pageid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-gh-chalk bg-gh-cream px-4 py-2 text-sm font-bold text-gh-ink-60 transition-colors hover:border-gh-ink-blue/20 hover:bg-gh-ink-blue hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-gh-chalk dark:hover:bg-gh-gold-glow dark:hover:text-gh-ink"
                  >
                    Read Full Article <ExternalLink size={14} />
                  </a>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Globe size={28} strokeWidth={1.75} />}
              title="Start a search"
              description="Type any topic to pull reference articles from Wikipedia."
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ResourceFetcher;

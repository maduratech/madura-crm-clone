import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';

interface RouterContextType {
  pathname: string;
  search: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);

  const navigate = useCallback((path: string) => {
    const [newPath, newSearch] = path.split('?');
    const searchString = newSearch ? `?${newSearch}` : '';

    if (window.location.pathname !== newPath || window.location.search !== searchString) {
      window.history.pushState({}, '', path);
      setPathname(newPath);
      setSearch(searchString);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = { pathname, search, navigate };

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};

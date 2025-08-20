import { useLocation, useNavigate } from 'react-router-dom';

export function useReturnTo() {
  const navigate = useNavigate();
  const location = useLocation();

  const goToWatch = (contentId: string) => {
    navigate(`/watch/${contentId}`, { state: { from: location.pathname, scrollY: window.scrollY } });
  };

  const goBack = (defaultPath = '/') => {
    if (location.state?.from) {
      navigate(location.state.from, { replace: false });
    } else {
      navigate(-1); // Go back in browser history
    }
  };

  const saveScroll = (pathname: string, y: number) => {
    sessionStorage.setItem(`scroll:${pathname}`, String(y));
  };

  const restoreScroll = (pathname: string) => {
    const y = Number(sessionStorage.getItem(`scroll:${pathname}`) || 0);
    window.scrollTo(0, y);
  };

  return { goToWatch, goBack, saveScroll, restoreScroll };
}
import { createContext, useContext, useState } from "react";

const FeedContext = createContext();

export function useFeedContext() {
  return useContext(FeedContext);
}

function FeedProvider({ children }) {
  const [{ tabName, tagName }, setTab] = useState({
    tabName: "global",
    tagName: "",
  });

  const changeTab = async (e, tabName) => {
    const tagName = e.target.innerText.trim();

    setTab({ tabName, tagName });
  };

  return (
    <FeedContext.Provider value={{ changeTab, tabName, tagName }}>
      {children}
    </FeedContext.Provider>
  );
}

export default FeedProvider;

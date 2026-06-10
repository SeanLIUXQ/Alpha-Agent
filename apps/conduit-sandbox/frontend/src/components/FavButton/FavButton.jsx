import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toggleFav from "../../services/toggleFav";

function FavButton({ favorited, favoritesCount, handler, right, slug, text }) {
  const [loading, setLoading] = useState(false);
  const { headers, isAuth } = useAuth();

  const buttonPosition = right ? "pull-xs-right" : "";
  const buttonStyle = favorited ? "active" : "";
  const buttonText = text ? "收藏" : !isAuth ? "" : "";

  const handleClick = () => {
    if (!isAuth) return alert("请先登录");

    setLoading(true);

    toggleFav({ slug, favorited, headers })
      .then(handler)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <button
      className={`btn btn-sm btn-outline-primary ${buttonPosition} ${buttonStyle}`}
      disabled={loading}
      onClick={handleClick}
    >
      <i className="ion-heart"></i> {buttonText}
      <span className="counter"> ( {favoritesCount} )</span>
    </button>
  );
}

export default FavButton;

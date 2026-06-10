import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="not-found">
      <h1>404 页面不存在</h1>
      <Link to="/">返回首页</Link>
    </div>
  );
}

export default NotFound;

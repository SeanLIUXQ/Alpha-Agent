import { Link } from "react-router-dom";
import SourceCodeLink from "../SourceCodeLink";

function Footer() {
  return (
    <div className="container">
      <Link to="/" className="logo-font">
        conduit
      </Link>
      <span className="attribution">
        一个用于本地预览和验证的 Conduit 中文文章社区。
      </span>

      <SourceCodeLink right />
    </div>
  );
}

export default Footer;

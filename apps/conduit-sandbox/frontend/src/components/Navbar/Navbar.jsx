import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NavItem from "../NavItem";
import SourceCodeLink from "../SourceCodeLink";
import DropdownMenu from "./DropdownMenu";

function Navbar() {
  const { isAuth } = useAuth();

  return (
    <nav className="navbar navbar-light">
      <div className="container">
        <Link className="navbar-brand" to="/">
          conduit
        </Link>

        <SourceCodeLink left />

        <ul className="nav navbar-nav pull-xs-right">
          <NavItem text="首页" icon="ion-compose" url="/" />

          {isAuth && (
            <>
              <NavItem text="写文章" icon="ion-compose" url="/editor" />
              <DropdownMenu />
            </>
          )}

          {!isAuth && (
            <>
              <NavItem text="登录" icon="ion-log-in" url="/login" />
              <NavItem text="注册" url="/register" />
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
export default Navbar;

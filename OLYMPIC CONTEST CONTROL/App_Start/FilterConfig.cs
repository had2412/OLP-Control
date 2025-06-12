using System.Web;
using System.Web.Mvc;

namespace OLYMPIC_CONTEST_CONTROL
{
    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());
        }
    }
}

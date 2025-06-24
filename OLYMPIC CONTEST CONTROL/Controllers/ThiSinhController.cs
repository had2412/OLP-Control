using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace OLYMPIC_CONTEST_CONTROL.Controllers
{
    public class ThiSinhController : Controller
    {
        // GET: ThiSinh
        public ActionResult Index()
        {
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }
    }
}
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
        public ActionResult VongMot()
        {
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }

        public ActionResult VongHai()
        {
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }

        public ActionResult VongBa()
        {
            var userId = Session["UserId"];
            var fullName = Session["FullName"];
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.UserId = userId;
            ViewBag.FullName = fullName;
            return View();
        }
    }
}
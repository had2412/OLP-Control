using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.SqlClient;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace OLYMPIC_CONTEST_CONTROL.Controllers
{
    public class AdminController : Controller
    {
        
        // GET: Admin
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
           
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }

        public ActionResult Questions()
        {
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }

        public ActionResult QuestionsVongHai()
        {
            if (Session["UserId"] == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            ViewBag.FullName = Session["FullName"];
            return View();
        }
        public ActionResult QuestionsVongBa()
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
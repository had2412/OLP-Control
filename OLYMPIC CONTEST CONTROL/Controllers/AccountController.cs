using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Web;
using System.Web.Mvc;

namespace OLYMPIC_CONTEST_CONTROL.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        public ActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public ActionResult Login(string username, string password)
        {
            using (var client = new HttpClient())
            {
                var res = client.GetAsync($"http://localhost:3000/api/users/login?username={username}&password={password}").Result;
                if (res.IsSuccessStatusCode)
                {
                    var json = res.Content.ReadAsStringAsync().Result;
                    dynamic user = JsonConvert.DeserializeObject(json);

                    Session["UserId"] = (int)user.UserId;
                    Session["FullName"] = (string)user.FullName;
                    Session["Role"] = (string)user.Role;

                    return RedirectToAction("Index", "ThiSinh");
                }
            }

            ViewBag.Error = "Sai tài khoản hoặc mật khẩu";
            return View();
        }

        public ActionResult Logout()
        {
            Session.Clear();
            return RedirectToAction("Login");
        }
    }

}
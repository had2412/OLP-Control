using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web.Mvc;
using Newtonsoft.Json;

namespace OLYMPIC_CONTEST_CONTROL.Controllers
{
    public class AuthController : Controller
    {
        private readonly string apiBase = "http://localhost:3000/api";

        [HttpGet]
        public ActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public async Task<ActionResult> Login(string username, string password)
        {
            using (HttpClient client = new HttpClient())
            {
                // Tạo dữ liệu JSON để gửi
                var data = new
                {
                    username = username,
                    password = password
                };

                var json = JsonConvert.SerializeObject(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                try
                {
                    var res = await client.PostAsync($"{apiBase}/users/login", content);

                    if (res.IsSuccessStatusCode)
                    {
                        var jsonResponse = await res.Content.ReadAsStringAsync();
                        var user = JsonConvert.DeserializeObject<UserLoginResult>(jsonResponse);

                        // ✅ Lưu vào session
                        Session["UserId"] = user.UserId;
                        Session["FullName"] = user.FullName;
                        Session["Role"] = user.Role;

                        return RedirectToAction("Index", "ThiSinh");
                    }
                    else
                    {
                        ViewBag.Error = "Sai tên đăng nhập hoặc mật khẩu";
                        return View();
                    }
                }
                catch (Exception ex)
                {
                    ViewBag.Error = "Lỗi khi kết nối server: " + ex.Message;
                    return View();
                }
            }
        }
    }

    public class UserLoginResult
    {
        public int UserId { get; set; }
        public string FullName { get; set; }
        public string Role { get; set; }
    }
}

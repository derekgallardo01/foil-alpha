[0;1;32m●[0m nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (]8;;file://ubuntu-s-2vcpu-4gb-120gb-intel-nyc1-01/usr/lib/systemd/system/nginx.service/usr/lib/systemd/system/nginx.service]8;;; [0;1;32menabled[0m; preset: [0;1;32menabled[0m)
     Active: [0;1;32mactive (running)[0m since Wed 2025-06-04 02:16:50 UTC; 10s ago
       Docs: ]8;;man:nginx(8)man:nginx(8)]8;;
    Process: 1699200 ExecStartPre=/usr/sbin/nginx -t -q -g daemon on; master_process on; (code=exited, status=0/SUCCESS)
    Process: 1699202 ExecStart=/usr/sbin/nginx -g daemon on; master_process on; (code=exited, status=0/SUCCESS)
   Main PID: 1699203 (nginx)
      Tasks: 3 (limit: 4658)
     Memory: 2.4M (peak: 2.6M)
        CPU: 19ms
     CGroup: /system.slice/nginx.service
             ├─[0;38;5;245m1699203 "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;"[0m
             ├─[0;38;5;245m1699204 "nginx: worker process"[0m
             └─[0;38;5;245m1699205 "nginx: worker process"[0m

Jun 04 02:16:50 ubuntu-s-2vcpu-4gb-120gb-intel-nyc1-01 systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Jun 04 02:16:50 ubuntu-s-2vcpu-4gb-120gb-intel-nyc1-01 systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.

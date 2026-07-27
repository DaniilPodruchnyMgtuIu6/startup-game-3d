# Implementation notes — office intrusion

`trackIntruderWalk()` — интервал 450 мс переигрывает medium-шот по живой
позиции нарушителя поверх его walk-промиса (§ «понятное приближение угрозы»).
Диалоги обеих веток покрыты `attachPerLineShots` (OTS со сменой сторон).
Эмоции 18C сохранены (Илья angry-controlled, Соня concerned). Игровая
логика resolveIntrusion не тронута.

import express from "express";
import pool from "../db.js";
const router = express.Router();

router.get("/:idCuenta", async (req,res)=>{
  try{
    const {idCuenta} = req.params;
    const [rows] = await pool.query("SELECT * FROM movimiento WHERE idCuenta=? ORDER BY fechaHora DESC",[idCuenta]);
    res.json(rows);
  }catch(err){
    res.status(500).json({error:err.message});
  }
});

export default router;

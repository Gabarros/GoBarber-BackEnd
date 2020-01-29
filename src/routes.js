import { Router } from 'express';
import User from './app/models/User';

const routes = new Router();

routes.get('/', async (req, res) => {

  const user = await User.create({
    name: 'Gabriel',
    email: 'gabarros17@gmail.com',
    password_hash: '123456'
  }).catch( err => {
    res.status(400).json(err);
  });

  return res.json(user);
  
  
});

export default routes;
